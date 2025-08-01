import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SEARCH_URL = 'https://hackathon.api.qloo.com/search';
const INSIGHTS_URL = 'https://hackathon.api.qloo.com/v2/insights';

function withCors(body: any, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

// Simple in-memory cache for search results
const searchCache = new Map<string, any[]>();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  // Extract interest entities from the new format
  const interestEntitiesQuery = searchParams.get('signal.interests.entities.query');
  
  if (!interestEntitiesQuery) {
    return withCors({ error: 'Missing signal.interests.entities.query parameter' }, 400);
  }

  const terms = interestEntitiesQuery.split(',').map((t) => t.trim()).filter(Boolean);
  console.log('Processing terms:', terms);

  const allEntities: any[] = [];
  const debugMatches: any[] = [];

  // Add longer delay between requests and between search terms to avoid rate limiting
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Step 1: Search for entities by term (with caching and delays)
  for (let i = 0; i < terms.length; i++) {
    const term = terms[i];
    
    // Check cache first
    const cacheKey = `search:${term}`;
    if (searchCache.has(cacheKey)) {
      const cachedResults = searchCache.get(cacheKey)!;
      allEntities.push(...cachedResults);
      debugMatches.push({ term, matchCount: cachedResults.length, cached: true });
      console.log(`Using cached results for "${term}": ${cachedResults.length} entities`);
      continue;
    }
    
    // Add delay between search terms
    if (i > 0) {
      await delay(500); // 100ms delay between search terms
    }
    const queryParams = new URLSearchParams({
      query: term,
      'filter.radius': '0',
      'operator.filter.tags': 'union',
      page: '1',
      sort_by: 'match',
      take: '5',
    });

    const fullUrl = `${SEARCH_URL}?${queryParams.toString()}`;
    console.log(`Searching for: "${term}" => ${fullUrl}`);

    try {
      const res = await fetch(fullUrl, {
        headers: {
          Accept: 'application/json',
          'x-api-key': process.env.QLOO_API_KEY!,
        },
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`Search error for "${term}":`, errorText);
        debugMatches.push({ term, error: errorText });
        continue;
      }

      const json = await res.json();
      const results = json.results || [];

      if (results.length > 0) {
        allEntities.push(...results);
        debugMatches.push({ term, matchCount: results.length });
        console.log(`Found ${results.length} entities for "${term}"`);
        
        // Cache the results
        searchCache.set(cacheKey, results);
      } else {
        debugMatches.push({ term, matchCount: 0 });
        console.log(`No entities found for "${term}"`);
        searchCache.set(cacheKey, []);
      }

    } catch (err: any) {
      console.error(`Error searching for "${term}":`, err);
      debugMatches.push({ term, error: err?.toString?.() ?? 'Unknown error' });
    }
  }

  const entityIds = allEntities.map((e) => e.entity_id).filter(Boolean);
  console.log(`Total entity IDs found: ${entityIds.length}`, entityIds);

  if (entityIds.length === 0) {
    return withCors({ 
      error: 'No valid entities found',
      debug: debugMatches,
      searchedTerms: terms
    }, 404);
  }

  // Get the requested entity type from URL params, or use all entity types
  const requestedType = searchParams.get('filter.type');
  const entityTypesToQuery = requestedType ? [requestedType] : [
    'urn:entity:artist',
    'urn:entity:book',
    'urn:entity:brand',
    'urn:entity:destination', 
    'urn:entity:movie',
    'urn:entity:person',
    'urn:entity:place',
    'urn:entity:podcast',
    'urn:entity:tv_show',
    'urn:entity:videogame'  // Fixed: videogame not video_game
  ];

  console.log(`Querying entity types:`, entityTypesToQuery);

  // Step 2: Get insights for each entity type (with longer delays)
  const allResults: any[] = [];

  for (let i = 0; i < entityTypesToQuery.length; i++) {
    const type = entityTypesToQuery[i];
    
    // Add longer delay between insights requests  
    if (i > 0) {
      await delay(500); // 500ms delay between insights requests
    }
    
    console.log(`Fetching insights for type ${type}`);

    console.log(`Entity IDs before transformation:`, entityIds);
    const entitiesWithId = entityIds.map(id => ({ id }));
    console.log(`Entities after transformation:`, entitiesWithId);

    const requestBody = {
      'filter.type': type,
      'signal.interests.entities': entitiesWithId,
      'signal.interests.entities.weight': 8,
      'take': 10,
      'feature.explainability': true
    };

    console.log(`Request body for ${type}:`, JSON.stringify(requestBody, null, 2));

    // Add demographic signals if provided
    const age = searchParams.get('signal.demographics.age');
    const gender = searchParams.get('signal.demographics.gender');
    
    if (age) {
      requestBody['signal.demographics.age'] = age;
      requestBody['signal.demographics.age.weight'] = parseInt(searchParams.get('signal.demographics.age.weight') || '5');
    }
    
    if (gender) {
      requestBody['signal.demographics.gender'] = gender;
      requestBody['signal.demographics.gender.weight'] = parseInt(searchParams.get('signal.demographics.gender.weight') || '5');
    }

    try {
      const res = await fetch(INSIGHTS_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'x-api-key': process.env.QLOO_API_KEY!,
        },
        body: JSON.stringify(requestBody)
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`Insights error for ${type}:`, errorText);
        continue;
      }

      const json = await res.json();
      console.log(`Response for ${type}:`, JSON.stringify(json, null, 2));
      
      // Handle the Qloo Insights API response format - results might be in different locations
      let results = [];
      if (json?.results?.entities && Array.isArray(json.results.entities)) {
        results = json.results.entities; // This is the correct Qloo format
      } else if (json?.results && Array.isArray(json.results)) {
        results = json.results;
      } else if (Array.isArray(json)) {
        results = json;
      }
      
      console.log(`Found ${results.length} results for ${type}`);
      
      const processedResults = results
        .map((item: any) => {
          const affinity = item?.affinity || item?.query?.affinity;
          const name = item?.name || item?.title;
          return affinity !== undefined && name ? { 
            name, 
            affinity, 
            entityType: type.replace('urn:entity:', '') 
          } : null;
        })
        .filter(Boolean);

      console.log(`Processed ${processedResults.length} results for ${type}`);
      allResults.push(...processedResults);

    } catch (err: any) {
      console.error(`Error fetching insights for ${type}:`, err);
    }
  }

  // Sort by affinity descending
  allResults.sort((a, b) => b.affinity - a.affinity);

  console.log(`Total results: ${allResults.length}`);

  // If we're querying a specific type, return results in the format the website expects
  if (requestedType) {
    const typeResults = allResults.filter(r => r.entityType === requestedType.replace('urn:entity:', ''));
    return withCors({
      results: typeResults,
      entityType: requestedType.replace('urn:entity:', ''),
      count: typeResults.length
    });
  }

  // For the website's multi-entity query, return results grouped by entity type
  const resultsByType = entityTypesToQuery.reduce((acc, type) => {
    const entityType = type.replace('urn:entity:', '');
    const typeResults = allResults.filter(r => r.entityType === entityType);
    acc[entityType] = typeResults;
    return acc;
  }, {} as Record<string, any[]>);

  // Return in the format the website expects
  return withCors({
    results: resultsByType,
    summary: `Found ${allResults.length} total recommendations across ${Object.keys(resultsByType).filter(k => resultsByType[k].length > 0).length} categories`,
    byCategory: Object.keys(resultsByType).map(entityType => ({
      entityType,
      count: resultsByType[entityType].length
    })),
    allResults: allResults
  });
}

export async function OPTIONS() {
  return withCors({});
}
