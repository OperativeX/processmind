require('dotenv').config();
const axios = require('axios');
const logger = require('./src/utils/logger');

// Test transcript
const testTranscript = `
In diesem Video erkläre ich die Grundlagen von Machine Learning und neuronalen Netzwerken. 
Wir werden Python und TensorFlow verwenden, um ein einfaches Modell zu erstellen.
Außerdem zeige ich, wie man Daten vorverarbeitet und das Modell trainiert.
Am Ende werden wir die Performance evaluieren und Optimierungen besprechen.
Dies ist ein Tutorial für Anfänger im Bereich Data Science und künstliche Intelligenz.
`;

async function testTagGeneration() {
  console.log('=== Testing ChatGPT Tag Generation ===\n');
  console.log('Test Transcript:', testTranscript);
  console.log('\n' + '='.repeat(50) + '\n');

  const openaiAPIKey = process.env.OPENAI_API_KEY;
  if (!openaiAPIKey) {
    console.error('ERROR: OPENAI_API_KEY not found in environment variables');
    process.exit(1);
  }

  // Create axios client (same as in aiService.js)
  const client = axios.create({
    baseURL: 'https://api.openai.com/v1',
    headers: {
      'Authorization': `Bearer ${openaiAPIKey}`,
      'Content-Type': 'application/json',
    },
    timeout: 120000,
  });

  // System prompt from aiService.js
  const systemPrompt = `Du bist ein Experte für Inhaltsanalyse und erstellst relevante, suchbare Tags mit Gewichtungen für Videoinhalte.

Analysiere das bereitgestellte Videotranskript und generiere hochwertige Tags mit Relevanz-Scores, die Nutzern helfen, diesen Inhalt zu finden und zu kategorisieren.

Richtlinien:
1. Generiere maximal 10 Tags mit Gewichtungen
2. Jeder Tag erhält eine Gewichtung von 0.0 bis 1.0 basierend auf Relevanz:
   - 0.8-1.0: Kernthemen, Hauptfokus des Videos, spezifische Fachbegriffe
   - 0.5-0.7: Wichtige Nebenthemen, erwähnte Technologien
   - 0.2-0.4: Beiläufig erwähnte Konzepte
   - Unter 0.2: NICHT ausgeben (zu generisch/irrelevant)
3. Verwende einzelne Wörter oder kurze Phrasen (max. 2-3 Wörter)
4. Fokussiere auf Hauptthemen, Konzepte, Technologien, Prozesse oder konkrete Inhalte
5. Vermeide allgemeine Tags wie "video", "inhalt", "information", "tutorial", "anleitung"
6. Verwende Kleinschreibung für Konsistenz
7. Berücksichksichtige sowohl explizit erwähnte als auch implizierte Themen
8. Schließe Fachbegriffe ein, wenn relevant
9. WICHTIG: Antworte in der Sprache des Transkripts
10. Gib nur Tags mit Gewichtung >= 0.2 aus

Du MUSST nur ein gültiges JSON-Array mit Objekten zurückgeben. Jedes Objekt hat "tag" und "weight". Keine zusätzlichen Erklärungen oder Markdown.

Beispiel-Ausgabeformat:
[
  {"tag": "machine learning", "weight": 0.95},
  {"tag": "neural networks", "weight": 0.88},
  {"tag": "python", "weight": 0.72},
  {"tag": "tensorflow", "weight": 0.65},
  {"tag": "data science", "weight": 0.55}
]`;

  const userPrompt = `Analyze this video transcript and generate relevant tags:

"${testTranscript}"`;

  try {
    console.log('Sending request to OpenAI...\n');
    
    const response = await client.post('/chat/completions', {
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 500,
      temperature: 0.3
    });

    const rawContent = response.data.choices[0]?.message?.content;
    
    console.log('=== RAW CHATGPT RESPONSE ===');
    console.log(rawContent);
    console.log('\n' + '='.repeat(50) + '\n');

    // Try to parse the response
    console.log('=== PARSING RESPONSE ===\n');
    
    let parsedData;
    try {
      parsedData = JSON.parse(rawContent);
      console.log('✓ Successfully parsed as JSON');
      console.log('Parsed data:', JSON.stringify(parsedData, null, 2));
    } catch (parseError) {
      console.log('✗ Failed to parse as JSON:', parseError.message);
      console.log('Will attempt fallback parsing...');
      
      // Fallback parsing attempt
      const tagRegex = /"([^"]+)"/g;
      const matches = rawContent.match(tagRegex);
      if (matches) {
        parsedData = matches.map(match => match.replace(/"/g, ''));
        console.log('Extracted tags via regex:', parsedData);
      }
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Analyze the format
    console.log('=== FORMAT ANALYSIS ===\n');
    
    if (Array.isArray(parsedData)) {
      console.log('✓ Response is an array');
      
      if (parsedData.length > 0) {
        const firstItem = parsedData[0];
        console.log('First item type:', typeof firstItem);
        console.log('First item:', firstItem);
        
        if (typeof firstItem === 'object' && firstItem.tag !== undefined && firstItem.weight !== undefined) {
          console.log('✓ WEIGHTED FORMAT DETECTED - Items have "tag" and "weight" properties');
          
          // Check all weights
          console.log('\nAll tags with weights:');
          parsedData.forEach((item, index) => {
            console.log(`  ${index + 1}. "${item.tag}" - Weight: ${item.weight}`);
          });
        } else if (typeof firstItem === 'string') {
          console.log('✗ LEGACY FORMAT DETECTED - Items are simple strings');
          console.log('This will result in all tags having weight 0.5!');
          
          console.log('\nAll tags (will get default weight 0.5):');
          parsedData.forEach((tag, index) => {
            console.log(`  ${index + 1}. "${tag}"`);
          });
        } else {
          console.log('✗ UNKNOWN FORMAT');
        }
      }
    } else {
      console.log('✗ Response is not an array');
      console.log('Type:', typeof parsedData);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Test with actual aiService logic
    console.log('=== TESTING WITH AISERVICE ===\n');
    const aiService = require('./src/services/aiService');
    
    const result = await aiService.generateTags(testTranscript, { maxTags: 10 });
    
    console.log('AIService Result:');
    console.log('- Legacy tags array:', result.tags);
    console.log('- Weighted tags:', JSON.stringify(result.tagWeights, null, 2));
    console.log('- Processing time:', result.processingTime + 's');
    console.log('- Tokens used:', result.tokensUsed);

  } catch (error) {
    console.error('ERROR:', error.message);
    if (error.response) {
      console.error('API Response:', error.response.data);
    }
  }
}

// Run the test
testTagGeneration().catch(console.error);