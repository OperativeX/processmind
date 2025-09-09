import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Switch,
  FormControlLabel,
  Alert,
  Paper,
  Divider,
  LinearProgress,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Settings as SettingsIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  CenterFocusStrong as CenterIcon,
  Fullscreen as FullscreenIcon,
  Close as CloseIcon,
  PlayArrow as PlayIcon,
  Tag as TagIcon,
  VideoLibrary as VideoIcon,
} from '@mui/icons-material';
import * as d3 from 'd3';
import { useQuery } from '@tanstack/react-query';

import { processAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { formatRelativeTime, getStatusColor } from '../../utils/helpers';
import LoadingScreen from '../../components/Common/LoadingScreen';

const GraphViewPage = () => {
  const navigate = useNavigate();
  const { tenant } = useAuth();
  const svgRef = useRef();
  const containerRef = useRef();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNodes, setSelectedNodes] = useState([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [simulation, setSimulation] = useState(null);

  // Graph settings
  const [settings, setSettings] = useState({
    linkDistance: 80,
    linkStrength: 0.8,
    chargeStrength: -300,
    showLabels: true,
    showTags: true,
    nodeSize: 8,
    tagSize: 7,
    colorBy: 'status', // status, date, tags
    mode: 'hybrid', // tags, semantic, hybrid
    similarityThreshold: 0.85,
  });

  // Debounced settings for API calls
  const [debouncedSettings, setDebouncedSettings] = useState(settings);
  
  // Update debounced settings after a delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSettings(settings);
    }, 500); // 500ms delay

    return () => clearTimeout(timer);
  }, [settings]);

  // Fetch graph data
  const { 
    data: graphData, 
    isLoading: graphLoading,
    error: graphError,
    refetch: refetchGraphData
  } = useQuery({
    queryKey: ['graph-data', tenant?.id, debouncedSettings.mode, debouncedSettings.similarityThreshold],
    queryFn: async () => {
      console.log('Fetching graph data for tenant:', tenant?.id, 'mode:', debouncedSettings.mode, 'threshold:', debouncedSettings.similarityThreshold);
      const response = await processAPI.getGraphData(tenant?.id, debouncedSettings.mode, debouncedSettings.similarityThreshold);
      console.log('Graph data response:', response);
      return response;
    },
    enabled: !!tenant?.id,
    select: (data) => {
      console.log('Raw data structure:', data);
      return data.data.data; // Need data.data.data because of axios response structure
    },
  });

  // Log graph data when it changes
  useEffect(() => {
    console.log('GraphData changed:', graphData);
  }, [graphData]);

  // Initialize D3 graph
  useEffect(() => {
    if (!graphData || !svgRef.current || !containerRef.current) return;
    
    console.log('Initializing D3 with data:', {
      nodes: graphData.nodes?.length,
      links: graphData.links?.length,
      stats: graphData.stats
    });

    const container = d3.select(containerRef.current);
    const svg = d3.select(svgRef.current);
    
    // Clear previous content
    svg.selectAll("*").remove();

    // Get container dimensions
    const containerRect = containerRef.current.getBoundingClientRect();
    const width = containerRect.width;
    const height = containerRect.height;

    svg.attr("width", width).attr("height", height);

    // Create zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    // Create main group for all elements
    const g = svg.append("g");

    // Prepare data
    const nodes = (graphData.nodes || []).map(d => ({ ...d }));
    const links = (graphData.links || []).map(d => ({ ...d }));

    // Filter nodes based on search
    const filteredNodes = nodes.filter(node => {
      if (!searchQuery) return true;
      const searchLower = searchQuery.toLowerCase();
      
      if (node.type === 'process') {
        return node.title?.toLowerCase().includes(searchLower) ||
               node.tags?.some(tag => tag.name.toLowerCase().includes(searchLower));
      } else if (node.type === 'tag') {
        return node.name.toLowerCase().includes(searchLower);
      }
      return false;
    });

    const filteredNodeIds = new Set(filteredNodes.map(d => d.id));
    const filteredLinks = links.filter(link => 
      filteredNodeIds.has(link.source.id || link.source) && 
      filteredNodeIds.has(link.target.id || link.target)
    );

    // Color scales
    const statusColorScale = d3.scaleOrdinal()
      .domain(['completed', 'processing', 'failed', 'uploaded'])
      .range(['#22c55e', '#3b82f6', '#ef4444', '#f59e0b']);

    const dateColorScale = d3.scaleSequential(d3.interpolateBlues)
      .domain(d3.extent(nodes.filter(d => d.createdAt), d => new Date(d.createdAt)));

    const getNodeColor = (node) => {
      if (node.type === 'tag') return '#7c3aed';
      
      switch (settings.colorBy) {
        case 'status':
          return statusColorScale(node.status);
        case 'date':
          return dateColorScale(new Date(node.createdAt));
        default:
          return '#6b7280';
      }
    };

    // Create simulation
    const newSimulation = d3.forceSimulation(filteredNodes)
      .force("link", d3.forceLink(filteredLinks)
        .id(d => d.id)
        .distance(settings.linkDistance)
        .strength(settings.linkStrength))
      .force("charge", d3.forceManyBody()
        .strength(settings.chargeStrength))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide()
        .radius(d => (d.type === 'tag' ? 20 : settings.nodeSize) + 5));

    setSimulation(newSimulation);

    // Create links
    const link = g.append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(filteredLinks)
      .join("line")
      .attr("stroke", d => {
        if (d.type === 'semantic') return '#10b981'; // Green for semantic
        if (d.type === 'hybrid') return '#8b5cf6'; // Purple for hybrid
        return '#30363d'; // Default for tag-based
      })
      .attr("stroke-opacity", d => {
        if (d.type === 'semantic' || d.type === 'hybrid') {
          return 0.3 + (parseFloat(d.similarity) * 0.5); // Opacity based on similarity
        }
        return 0.6;
      })
      .attr("stroke-width", d => {
        if (d.type === 'tag-process') return 1;
        if (d.type === 'process-process') return Math.min(3, d.sharedTags?.length || 1);
        if (d.type === 'semantic' || d.type === 'hybrid') {
          return 1 + (parseFloat(d.similarity) * 3); // Width based on similarity
        }
        return 1;
      });

    // Create nodes
    const node = g.append("g")
      .attr("class", "nodes")
      .selectAll("circle")
      .data(filteredNodes)
      .join("circle")
      .attr("r", d => d.type === 'tag' ? settings.tagSize : settings.nodeSize)
      .attr("fill", getNodeColor)
      .attr("stroke", "#f0f6fc")
      .attr("stroke-width", 1.5)
      .style("cursor", "pointer");

    // Add node labels
    let labels = null;
    if (settings.showLabels) {
      labels = g.append("g")
        .attr("class", "labels")
        .selectAll("text")
        .data(filteredNodes)
        .join("text")
        .attr("dy", ".35em")
        .attr("text-anchor", "middle")
        .style("fill", "#f0f6fc")
        .style("font-size", "10px")
        .style("font-weight", "500")
        .style("pointer-events", "none")
        .text(d => {
          if (d.type === 'tag') return d.name;
          return d.title?.substring(0, 15) + (d.title?.length > 15 ? '...' : '');
        });
    }

    // Node interactions
    node
      .on("click", (event, d) => {
        event.stopPropagation();
        if (d.type === 'process') {
          navigate(`/processes/${d.id}`);
        } else {
          setSelectedItem(d);
          setDetailsOpen(true);
        }
      })
      .on("mouseover", (event, d) => {
        // Highlight connected nodes and links
        const connectedNodeIds = new Set();
        const connectedLinkIds = new Set();
        
        filteredLinks.forEach(link => {
          if (link.source.id === d.id || link.target.id === d.id) {
            connectedNodeIds.add(link.source.id);
            connectedNodeIds.add(link.target.id);
            connectedLinkIds.add(link);
          }
        });

        node.style("opacity", n => connectedNodeIds.has(n.id) ? 1 : 0.3);
        link.style("opacity", l => connectedLinkIds.has(l) ? 1 : 0.1);
        
        if (labels) {
          labels.style("opacity", n => connectedNodeIds.has(n.id) ? 1 : 0.3);
        }

        // Show tooltip
        const tooltip = d3.select("body").append("div")
          .attr("class", "graph-tooltip")
          .style("position", "absolute")
          .style("background", "rgba(22, 27, 34, 0.95)")
          .style("color", "#f0f6fc")
          .style("padding", "8px 12px")
          .style("border-radius", "6px")
          .style("border", "1px solid #30363d")
          .style("font-size", "12px")
          .style("pointer-events", "none")
          .style("z-index", 1000)
          .style("box-shadow", "0 4px 12px rgba(0, 0, 0, 0.3)")
          .html(d.type === 'process' 
            ? `<strong>${d.title || 'Untitled'}</strong><br/>
               Status: ${d.status}<br/>
               Created: ${formatRelativeTime(d.createdAt)}<br/>
               Tags: ${d.tags?.length || 0}`
            : `<strong>Tag: ${d.name}</strong><br/>
               Used in ${d.count} process${d.count !== 1 ? 'es' : ''}`
          );

        tooltip
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 10) + "px");
      })
      .on("mouseout", () => {
        node.style("opacity", 1);
        link.style("opacity", 1);
        if (labels) labels.style("opacity", 1);
        
        d3.selectAll(".graph-tooltip").remove();
      });

    // Add drag behavior
    const drag = d3.drag()
      .on("start", (event, d) => {
        if (!event.active) newSimulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) newSimulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    node.call(drag);

    // Update positions on simulation tick
    newSimulation.on("tick", () => {
      link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

      node
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);

      if (labels) {
        labels
          .attr("x", d => d.x)
          .attr("y", d => d.y + (d.type === 'tag' ? 25 : 15));
      }
    });

    // Center graph function
    window.centerGraph = () => {
      const bounds = g.node().getBBox();
      const fullWidth = width;
      const fullHeight = height;
      const width_ = bounds.width;
      const height_ = bounds.height;
      const midX = bounds.x + width_ / 2;
      const midY = bounds.y + height_ / 2;
      
      if (width_ === 0 || height_ === 0) return;
      
      const scale = Math.min(fullWidth / width_, fullHeight / height_) * 0.9;
      const translate = [fullWidth / 2 - scale * midX, fullHeight / 2 - scale * midY];
      
      svg.transition()
        .duration(750)
        .call(zoom.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale));
    };

    // Cleanup function
    return () => {
      newSimulation.stop();
      d3.selectAll(".graph-tooltip").remove();
    };
  }, [graphData, settings, searchQuery, navigate]);

  // Update simulation forces when settings change
  useEffect(() => {
    if (!simulation) return;

    // Update link force
    const linkForce = simulation.force("link");
    if (linkForce) {
      linkForce.distance(settings.linkDistance).strength(settings.linkStrength);
    }
    
    // Update charge force
    const chargeForce = simulation.force("charge");
    if (chargeForce) {
      chargeForce.strength(settings.chargeStrength);
    }

    simulation.alpha(0.3).restart();
  }, [simulation, settings.linkDistance, settings.linkStrength, settings.chargeStrength]);

  const handleZoomIn = () => {
    const svg = d3.select(svgRef.current);
    svg.transition().call(d3.zoom().scaleBy, 1.5);
  };

  const handleZoomOut = () => {
    const svg = d3.select(svgRef.current);
    svg.transition().call(d3.zoom().scaleBy, 1 / 1.5);
  };

  const handleCenter = () => {
    if (window.centerGraph) {
      window.centerGraph();
    }
  };

  const handleFullscreen = () => {
    if (containerRef.current.requestFullscreen) {
      containerRef.current.requestFullscreen();
    }
  };

  // Safe handler for similarity threshold changes
  const handleSimilarityThresholdChange = useCallback((event, value) => {
    if (value !== undefined && value !== null) {
      setSettings(prev => ({ ...prev, similarityThreshold: value }));
    }
  }, []);

  if (graphLoading) {
    return <LoadingScreen message="Loading graph data..." />;
  }

  if (graphError) {
    return (
      <Alert severity="error" sx={{ m: 3 }}>
        Failed to load graph data. Please try again.
      </Alert>
    );
  }

  if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <VideoIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
          No data to visualize
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Upload some videos with tags to see the network visualization
        </Typography>
        <Button
          variant="contained"
          onClick={() => navigate('/upload')}
        >
          Upload Video
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ mb: 1, fontWeight: 600 }}>
            Graph View
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Explore connections between your processes and tags
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            placeholder="Search processes and tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="small"
            sx={{ width: 250 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <IconButton onClick={() => setSettingsOpen(true)}>
            <SettingsIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Graph Stats */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <Chip 
          label={`${graphData.stats?.processCount || 0} Processes`} 
          color="primary" 
          variant="outlined" 
        />
        <Chip 
          label={`${graphData.stats?.tagCount || 0} Tags`} 
          color="secondary" 
          variant="outlined" 
        />
        <Chip 
          label={`${graphData.stats?.linkCount || 0} Connections`} 
          color="default" 
          variant="outlined" 
        />
      </Box>

      {/* Graph Container */}
      <Card sx={{ flexGrow: 1, position: 'relative', overflow: 'hidden' }}>
        {graphLoading && (
          <LinearProgress 
            sx={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              right: 0, 
              zIndex: 1 
            }} 
          />
        )}
        <Box
          ref={containerRef}
          sx={{
            width: '100%',
            height: '100%',
            minHeight: 600,
            position: 'relative',
            backgroundColor: 'background.default',
          }}
        >
          <svg ref={svgRef} style={{ width: '100%', height: '100%' }} />
          
          {/* Control Panel */}
          <Box
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
            }}
          >
            <IconButton 
              onClick={handleZoomIn}
              sx={{ 
                backgroundColor: 'background.paper',
                '&:hover': { backgroundColor: 'action.hover' }
              }}
            >
              <ZoomInIcon />
            </IconButton>
            <IconButton 
              onClick={handleZoomOut}
              sx={{ 
                backgroundColor: 'background.paper',
                '&:hover': { backgroundColor: 'action.hover' }
              }}
            >
              <ZoomOutIcon />
            </IconButton>
            <IconButton 
              onClick={handleCenter}
              sx={{ 
                backgroundColor: 'background.paper',
                '&:hover': { backgroundColor: 'action.hover' }
              }}
            >
              <CenterIcon />
            </IconButton>
            <IconButton 
              onClick={handleFullscreen}
              sx={{ 
                backgroundColor: 'background.paper',
                '&:hover': { backgroundColor: 'action.hover' }
              }}
            >
              <FullscreenIcon />
            </IconButton>
          </Box>

          {/* Legend */}
          <Paper
            sx={{
              position: 'absolute',
              bottom: 16,
              left: 16,
              p: 2,
              minWidth: 200,
            }}
          >
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Legend
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                Nodes
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    backgroundColor: '#22c55e',
                  }}
                />
                <Typography variant="caption">Completed Processes</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    backgroundColor: '#3b82f6',
                  }}
                />
                <Typography variant="caption">Processing</Typography>
              </Box>
              {settings.mode !== 'semantic' && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      backgroundColor: '#7c3aed',
                    }}
                  />
                  <Typography variant="caption">Tags</Typography>
                </Box>
              )}
              
              {(settings.mode === 'semantic' || settings.mode === 'hybrid') && (
                <>
                  <Typography variant="caption" sx={{ fontWeight: 'bold', mt: 1, mb: 0.5 }}>
                    Links
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box
                      sx={{
                        width: 24,
                        height: 2,
                        backgroundColor: '#10b981',
                      }}
                    />
                    <Typography variant="caption">Semantic Similarity</Typography>
                  </Box>
                  {settings.mode === 'hybrid' && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        sx={{
                          width: 24,
                          height: 2,
                          backgroundColor: '#8b5cf6',
                        }}
                      />
                      <Typography variant="caption">Hybrid Connection</Typography>
                    </Box>
                  )}
                </>
              )}
            </Box>
          </Paper>
        </Box>
      </Card>

      {/* Settings Drawer */}
      <Drawer
        anchor="right"
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        PaperProps={{
          sx: { width: 350 }
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Graph Settings</Typography>
            <IconButton onClick={() => setSettingsOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>

          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Link Distance
            </Typography>
            <Slider
              value={settings.linkDistance}
              onChange={(e, value) => setSettings(prev => ({ ...prev, linkDistance: value }))}
              min={50}
              max={200}
              valueLabelDisplay="auto"
            />
          </Box>

          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Link Strength
            </Typography>
            <Slider
              value={settings.linkStrength}
              onChange={(e, value) => setSettings(prev => ({ ...prev, linkStrength: value }))}
              min={0.1}
              max={1}
              step={0.1}
              valueLabelDisplay="auto"
            />
          </Box>

          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Charge Strength
            </Typography>
            <Slider
              value={Math.abs(settings.chargeStrength)}
              onChange={(e, value) => setSettings(prev => ({ ...prev, chargeStrength: -value }))}
              min={100}
              max={500}
              valueLabelDisplay="auto"
            />
          </Box>

          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Node Size
            </Typography>
            <Slider
              value={settings.nodeSize}
              onChange={(e, value) => setSettings(prev => ({ ...prev, nodeSize: value }))}
              min={4}
              max={16}
              valueLabelDisplay="auto"
            />
          </Box>

          {settings.showTags && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Tag Size
              </Typography>
              <Slider
                value={settings.tagSize}
                onChange={(e, value) => setSettings(prev => ({ ...prev, tagSize: value }))}
                min={4}
                max={16}
                valueLabelDisplay="auto"
              />
            </Box>
          )}

          <Box sx={{ mb: 3 }}>
            <FormControl fullWidth>
              <InputLabel>Color By</InputLabel>
              <Select
                value={settings.colorBy}
                onChange={(e) => setSettings(prev => ({ ...prev, colorBy: e.target.value }))}
                label="Color By"
              >
                <MenuItem value="status">Status</MenuItem>
                <MenuItem value="date">Creation Date</MenuItem>
                <MenuItem value="tags">Tags</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <Divider sx={{ my: 2 }} />
          
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              Graph Mode
            </Typography>
            <FormControl fullWidth>
              <InputLabel>Connection Type</InputLabel>
              <Select
                value={settings.mode}
                onChange={(e) => setSettings(prev => ({ ...prev, mode: e.target.value }))}
                label="Connection Type"
              >
                <MenuItem value="tags">Tag-based</MenuItem>
                <MenuItem value="semantic">Semantic Similarity</MenuItem>
                <MenuItem value="hybrid">Hybrid (Tags + Semantic)</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {(settings.mode === 'semantic' || settings.mode === 'hybrid') && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Similarity Threshold: {settings.similarityThreshold.toFixed(2)}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                Lower values show more connections, higher values show only strong similarities
              </Typography>
              <Slider
                key="similarity-threshold-slider"
                value={settings.similarityThreshold}
                onChange={handleSimilarityThresholdChange}
                min={0.5}
                max={0.95}
                step={0.01}
                valueLabelDisplay="auto"
                marks={[
                  { value: 0.5, label: '0.5' },
                  { value: 0.7, label: '0.7' },
                  { value: 0.9, label: '0.9' },
                ]}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Current: {graphData?.stats?.linkCount || 0} connections found
                {JSON.stringify(settings) !== JSON.stringify(debouncedSettings) && ' (updating...)'}
              </Typography>
            </Box>
          )}

          <FormControlLabel
            control={
              <Switch
                checked={settings.showLabels}
                onChange={(e) => setSettings(prev => ({ ...prev, showLabels: e.target.checked }))}
              />
            }
            label="Show Labels"
            sx={{ mb: 2 }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={settings.showTags}
                onChange={(e) => setSettings(prev => ({ ...prev, showTags: e.target.checked }))}
              />
            }
            label="Show Tag Nodes"
          />
        </Box>
      </Drawer>

      {/* Details Drawer */}
      <Drawer
        anchor="right"
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        PaperProps={{
          sx: { width: 400 }
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              {selectedItem?.type === 'tag' ? 'Tag Details' : 'Process Details'}
            </Typography>
            <IconButton onClick={() => setDetailsOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>

          {selectedItem && (
            <Box>
              {selectedItem.type === 'tag' ? (
                <Box>
                  <Typography variant="h5" sx={{ mb: 1 }}>
                    #{selectedItem.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Used in {selectedItem.count} process{selectedItem.count !== 1 ? 'es' : ''}
                  </Typography>
                  
                  <Button
                    variant="outlined"
                    onClick={() => {
                      navigate(`/processes?tags=${encodeURIComponent(selectedItem.name)}`);
                      setDetailsOpen(false);
                    }}
                    fullWidth
                  >
                    View Related Processes
                  </Button>
                </Box>
              ) : (
                <Box>
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    {selectedItem.title}
                  </Typography>
                  <Chip 
                    label={selectedItem.status} 
                    color={getStatusColor(selectedItem.status)}
                    size="small"
                    sx={{ mb: 2 }}
                  />
                  
                  {selectedItem.tags && selectedItem.tags.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Tags:
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selectedItem.tags.map((tag, index) => (
                          <Chip 
                            key={index} 
                            label={tag.name} 
                            size="small" 
                            variant={tag.weight >= 0.7 ? "filled" : "outlined"}
                            color={tag.weight >= 0.7 ? "primary" : "default"}
                            sx={{ 
                              fontWeight: tag.weight >= 0.7 ? 'bold' : 'normal'
                            }}
                          />
                        ))}
                      </Box>
                    </Box>
                  )}

                  <Button
                    variant="contained"
                    startIcon={<PlayIcon />}
                    onClick={() => {
                      navigate(`/processes/${selectedItem.id}`);
                      setDetailsOpen(false);
                    }}
                    fullWidth
                  >
                    View Process
                  </Button>
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Drawer>
    </Box>
  );
};

export default GraphViewPage;