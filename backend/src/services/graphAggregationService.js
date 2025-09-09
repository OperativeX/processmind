const mongoose = require('mongoose');
const { Process } = require('../models');
const logger = require('../utils/logger');

/**
 * Graph Aggregation Service - Optimized MongoDB aggregation pipelines for graph data
 * Replaces inefficient O(n²) JavaScript similarity calculations
 */
class GraphAggregationService {
  /**
   * Get graph data with similarity calculations using MongoDB aggregation
   * @param {string} tenantId - Tenant ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Graph data with nodes and edges
   */
  static async getGraphData(tenantId, options = {}) {
    const startTime = Date.now();
    
    try {
      const {
        limit = 250,
        minSimilarity = 0.1,
        tags = [],
        dateFrom,
        dateTo,
        userId
      } = options;

      // Build match stage
      const matchStage = {
        tenantId: new mongoose.Types.ObjectId(tenantId),
        isDeleted: false,
        embedding: { $exists: true, $ne: null, $size: 1536 }
      };

      if (userId) {
        matchStage.userId = new mongoose.Types.ObjectId(userId);
      }

      if (dateFrom || dateTo) {
        matchStage.createdAt = {};
        if (dateFrom) matchStage.createdAt.$gte = new Date(dateFrom);
        if (dateTo) matchStage.createdAt.$lte = new Date(dateTo);
      }

      if (tags.length > 0) {
        matchStage['tags.name'] = { $in: tags };
      }

      // Main aggregation pipeline
      const pipeline = [
        // Match stage
        { $match: matchStage },
        
        // Sort by creation date
        { $sort: { createdAt: -1 } },
        
        // Limit results
        { $limit: limit },
        
        // Project necessary fields
        {
          $project: {
            _id: 1,
            title: 1,
            tags: 1,
            createdAt: 1,
            userId: 1,
            shareId: 1,
            embedding: 1,
            'files.processed.duration': 1
          }
        },
        
        // Add node properties
        {
          $addFields: {
            id: { $toString: '$_id' },
            nodeSize: {
              $cond: {
                if: { $isArray: '$tags' },
                then: { $size: '$tags' },
                else: 0
              }
            },
            topTags: {
              $slice: [
                {
                  $filter: {
                    input: { $ifNull: ['$tags', []] },
                    cond: { $gte: ['$$this.weight', 0.5] }
                  }
                },
                3
              ]
            }
          }
        }
      ];

      // Execute main pipeline
      const nodes = await Process.aggregate(pipeline);

      if (nodes.length === 0) {
        return { nodes: [], edges: [], statistics: { nodeCount: 0, edgeCount: 0 } };
      }

      // Calculate similarities using aggregation (if node count is reasonable)
      let edges = [];
      if (nodes.length <= 50) {
        // For small datasets, calculate all similarities
        edges = await this.calculateAllSimilarities(nodes, minSimilarity);
      } else {
        // For larger datasets, use tag-based similarities
        edges = await this.calculateTagBasedSimilarities(nodes, matchStage, minSimilarity);
      }

      // Calculate statistics
      const statistics = {
        nodeCount: nodes.length,
        edgeCount: edges.length,
        avgEdgesPerNode: edges.length > 0 ? (edges.length * 2) / nodes.length : 0,
        processingTime: Date.now() - startTime
      };

      // Clean up node data for frontend
      const cleanNodes = nodes.map(node => ({
        id: node.id,
        title: node.title,
        tags: node.topTags,
        createdAt: node.createdAt,
        size: Math.min(30, 10 + node.nodeSize * 2),
        color: this.getNodeColor(node.tags)
      }));

      logger.info('Graph data aggregation completed', {
        tenantId,
        nodes: cleanNodes.length,
        edges: edges.length,
        processingTime: statistics.processingTime
      });

      return {
        nodes: cleanNodes,
        edges,
        statistics
      };

    } catch (error) {
      logger.error('Graph aggregation failed:', error);
      throw error;
    }
  }

  /**
   * Calculate all similarities for small datasets
   */
  static async calculateAllSimilarities(nodes, minSimilarity) {
    const edges = [];
    
    // Use MongoDB aggregation for similarity calculation
    const pipeline = [
      {
        $match: {
          _id: { $in: nodes.map(n => n._id) }
        }
      },
      {
        $lookup: {
          from: 'processes',
          let: { 
            currentId: '$_id',
            currentEmbedding: '$embedding'
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $in: ['$_id', nodes.map(n => n._id)] },
                    { $ne: ['$_id', '$$currentId'] },
                    { $gt: ['$_id', '$$currentId'] } // Avoid duplicate pairs
                  ]
                }
              }
            },
            {
              $project: {
                _id: 1,
                similarity: {
                  $divide: [
                    {
                      $reduce: {
                        input: { $range: [0, 1536] },
                        initialValue: 0,
                        in: {
                          $add: [
                            '$$value',
                            {
                              $multiply: [
                                { $arrayElemAt: ['$$currentEmbedding', '$$this'] },
                                { $arrayElemAt: ['$embedding', '$$this'] }
                              ]
                            }
                          ]
                        }
                      }
                    },
                    {
                      $multiply: [
                        {
                          $sqrt: {
                            $reduce: {
                              input: '$$currentEmbedding',
                              initialValue: 0,
                              in: { $add: ['$$value', { $multiply: ['$$this', '$$this'] }] }
                            }
                          }
                        },
                        {
                          $sqrt: {
                            $reduce: {
                              input: '$embedding',
                              initialValue: 0,
                              in: { $add: ['$$value', { $multiply: ['$$this', '$$this'] }] }
                            }
                          }
                        }
                      ]
                    }
                  ]
                }
              }
            },
            {
              $match: {
                similarity: { $gte: minSimilarity }
              }
            }
          ],
          as: 'similar'
        }
      },
      {
        $unwind: '$similar'
      },
      {
        $project: {
          source: { $toString: '$_id' },
          target: { $toString: '$similar._id' },
          value: { $round: ['$similar.similarity', 3] }
        }
      }
    ];

    try {
      const similarities = await Process.aggregate(pipeline);
      return similarities;
    } catch (error) {
      logger.warn('Full similarity calculation failed, falling back to tag-based:', error);
      return [];
    }
  }

  /**
   * Calculate tag-based similarities for larger datasets
   */
  static async calculateTagBasedSimilarities(nodes, baseMatch, minSimilarity) {
    const edges = [];
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    
    // Group nodes by shared tags
    const tagGroups = new Map();
    nodes.forEach(node => {
      if (node.tags && Array.isArray(node.tags)) {
        node.tags.forEach(tag => {
          if (tag.weight >= 0.3) {
            if (!tagGroups.has(tag.name)) {
              tagGroups.set(tag.name, []);
            }
            tagGroups.get(tag.name).push(node.id);
          }
        });
      }
    });

    // Create edges based on shared high-weight tags
    const processedPairs = new Set();
    
    tagGroups.forEach((nodeIds, tagName) => {
      if (nodeIds.length < 2) return;
      
      // Connect nodes with same tag
      for (let i = 0; i < nodeIds.length - 1; i++) {
        for (let j = i + 1; j < nodeIds.length; j++) {
          const pairKey = [nodeIds[i], nodeIds[j]].sort().join('-');
          
          if (!processedPairs.has(pairKey)) {
            processedPairs.add(pairKey);
            
            const node1 = nodeMap.get(nodeIds[i]);
            const node2 = nodeMap.get(nodeIds[j]);
            
            // Calculate tag-based similarity
            const sharedTags = this.getSharedTags(node1.tags, node2.tags);
            const similarity = this.calculateTagSimilarity(node1.tags, node2.tags, sharedTags);
            
            if (similarity >= minSimilarity) {
              edges.push({
                source: nodeIds[i],
                target: nodeIds[j],
                value: Math.round(similarity * 100) / 100,
                sharedTags: sharedTags.map(t => t.name)
              });
            }
          }
        }
      }
    });

    return edges;
  }

  /**
   * Get shared tags between two tag arrays
   */
  static getSharedTags(tags1, tags2) {
    if (!tags1 || !tags2) return [];
    
    const tagMap = new Map(tags1.map(t => [t.name, t]));
    return tags2.filter(t => tagMap.has(t.name));
  }

  /**
   * Calculate similarity based on tags
   */
  static calculateTagSimilarity(tags1, tags2, sharedTags) {
    if (!tags1?.length || !tags2?.length) return 0;
    
    const totalWeight1 = tags1.reduce((sum, t) => sum + t.weight, 0);
    const totalWeight2 = tags2.reduce((sum, t) => sum + t.weight, 0);
    const sharedWeight = sharedTags.reduce((sum, t) => sum + t.weight * 2, 0);
    
    return sharedWeight / (totalWeight1 + totalWeight2);
  }

  /**
   * Get node color based on tags
   */
  static getNodeColor(tags) {
    if (!tags || tags.length === 0) return '#666';
    
    // Color based on dominant tag category
    const topTag = tags[0]?.name?.toLowerCase() || '';
    
    const colorMap = {
      'meeting': '#4CAF50',
      'presentation': '#2196F3',
      'tutorial': '#FF9800',
      'discussion': '#9C27B0',
      'review': '#F44336',
      'planning': '#00BCD4',
      'training': '#FFEB3B',
      'demo': '#795548'
    };

    for (const [keyword, color] of Object.entries(colorMap)) {
      if (topTag.includes(keyword)) return color;
    }

    // Default color based on hash
    let hash = 0;
    for (let i = 0; i < topTag.length; i++) {
      hash = topTag.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 50%)`;
  }

  /**
   * Get process recommendations based on similarity
   */
  static async getRecommendations(processId, tenantId, limit = 10) {
    try {
      const pipeline = [
        // Find the target process
        {
          $match: {
            _id: new mongoose.Types.ObjectId(processId),
            tenantId: new mongoose.Types.ObjectId(tenantId),
            isDeleted: false
          }
        },
        
        // Get similar processes
        {
          $lookup: {
            from: 'processes',
            let: { 
              targetTags: '$tags',
              targetEmbedding: '$embedding',
              targetId: '$_id'
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$tenantId', new mongoose.Types.ObjectId(tenantId)] },
                      { $eq: ['$isDeleted', false] },
                      { $ne: ['$_id', '$$targetId'] },
                      { $gt: [{ $size: { $ifNull: ['$embedding', []] } }, 0] }
                    ]
                  }
                }
              },
              
              // Calculate similarity score
              {
                $addFields: {
                  tagSimilarity: {
                    $size: {
                      $setIntersection: [
                        { $map: { input: '$tags', in: '$$this.name' } },
                        { $map: { input: '$$targetTags', in: '$$this.name' } }
                      ]
                    }
                  }
                }
              },
              
              // Sort by similarity
              { $sort: { tagSimilarity: -1, createdAt: -1 } },
              
              // Limit results
              { $limit: limit },
              
              // Project necessary fields
              {
                $project: {
                  _id: 1,
                  title: 1,
                  tags: 1,
                  createdAt: 1,
                  shareId: 1,
                  tagSimilarity: 1
                }
              }
            ],
            as: 'recommendations'
          }
        },
        
        // Unwind recommendations
        { $unwind: '$recommendations' },
        
        // Reshape output
        {
          $replaceRoot: {
            newRoot: '$recommendations'
          }
        }
      ];

      const recommendations = await Process.aggregate(pipeline);
      
      return recommendations;
      
    } catch (error) {
      logger.error('Failed to get recommendations:', error);
      throw error;
    }
  }
}

module.exports = GraphAggregationService;