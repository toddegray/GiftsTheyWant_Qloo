import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

interface ParsedProfile {
  // Demographics
  demographics: {
    age?: string; // "10", "25", "45" - actual age or age range
    ageGroup?: string; // "35_and_younger" | "36_to_55" | "55_and_older"
    gender?: string; // "male" | "female"
  };
  
  // Location
  location?: {
    query?: string; // "New York", "Los Angeles"
    countryCode?: string; // "US", "CA", "UK"
  };
  
  // Interest categories
  interests: {
    // Specific entities mentioned
    entities: {
      artists?: string[]; // ["Justin Bieber", "Taylor Swift"]
      movies?: string[]; // ["Star Wars", "Marvel"]
      tvShows?: string[]; // ["Stranger Things"]
      brands?: string[]; // ["Nike", "Apple"]
      products?: string[]; // ["Pokemon", "Legos"]
      places?: string[]; // ["Disneyland"]
    };
    
    // General topic/tag categories
    topics: string[]; // ["gaming", "music", "sports", "technology"]
  };
  
  // Preferences
  preferences?: {
    priceLevel?: { min?: number; max?: number }; // 1-4
    quality?: "budget" | "standard" | "premium" | "luxury";
  };
}

interface QlooInsightQueries {
  // Queries for all entity types
  artist?: Record<string, any>;
  book?: Record<string, any>;
  brand?: Record<string, any>;
  destination?: Record<string, any>;
  movie?: Record<string, any>;
  person?: Record<string, any>;
  place?: Record<string, any>;
  podcast?: Record<string, any>;
  tv_show?: Record<string, any>;
  videogame?: Record<string, any>;
  
  // The parsed profile for reference
  profile: ParsedProfile;
}

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();
    
    if (!text) {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    const systemPrompt = `You are an assistant that parses user descriptions into structured demographic and interest data for gift recommendation APIs.

Parse the following information from the text:

1. DEMOGRAPHICS:
   - age: Extract specific age if mentioned (e.g., "10", "25", "45") or age terms ("teenager", "adult", "senior")
   - gender: Extract if clearly mentioned ("boy", "girl", "man", "woman", "male", "female")

2. LOCATION:
   - Extract any mentioned cities, states, or countries
   - Convert countries to 2-letter codes when possible (US, CA, UK, etc.)

3. INTERESTS - Categorize mentioned items:
   - artists: Musicians, singers, bands (e.g., "Justin Bieber", "Taylor Swift")
   - movies: Films or movie franchises (e.g., "Star Wars", "Marvel movies")
   - tvShows: TV series (e.g., "Stranger Things", "The Office")  
   - brands: Company/brand names (e.g., "Nike", "Apple", "Disney")
   - products: Specific products, toys, games (e.g., "Pokemon", "Legos", "iPhone")
   - places: Locations, venues, attractions (e.g., "Disneyland", "beaches")

4. TOPICS: Extract general interest categories/themes:
   - This is your catch-all: split out everything the user “loves/likes/enjoys” this is intended as a way to see the parsed likes and interests.
   - Examples: The input string is "My 45 yr old brother loves golf, The Office, Kansas City Chiefs football, and Tokyo" then we'd expect a list that includes
     "golf", "The Office", "Kansas City Chiefs", "football", "Tokyo", the topics list will be the parsed list of items they like.

5. PREFERENCES:
   - Extract any budget/quality preferences ("expensive", "cheap", "high-end", "budget")

Convert gender to Qloo format of male or female

Convert ages to Qloo format:
- Under 36: "35_and_younger"  
- 36-55: "36_to_55"
- Over 55: "55_and_older"

Respond with ONLY a JSON object matching this structure. Only include fields that are clearly present in the text.`;

    const userPrompt = `Parse this description: "${text}"`;

    const openaiRes = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2
      })
    });

    if (!openaiRes.ok) {
      const errorText = await openaiRes.text();
      return NextResponse.json({ error: errorText }, { status: openaiRes.status });
    }

    const { choices } = await openaiRes.json();
    const content = choices[0].message.content;
console.log("📝 [Extract API] raw GPT response:", content);    
    try {
      const rawProfile: any = JSON.parse(content);
      
      // Handle both uppercase and lowercase response formats
      const demographics = rawProfile.demographics || rawProfile.DEMOGRAPHICS || {};
      const interests = rawProfile.interests || rawProfile.INTERESTS || {};
      const location = rawProfile.location || rawProfile.LOCATION || {};
      const preferences = rawProfile.preferences || rawProfile.PREFERENCES || {};
      
      // Normalize the profile structure
      const profile: ParsedProfile = {
        demographics: {
          age: demographics.age,
          gender: demographics.gender === 'boy' ? 'male' : demographics.gender === 'girl' ? 'female' : demographics.gender,
        },
        location: location.query || location.countryCode ? {
          query: location.query,
          countryCode: location.countryCode
        } : undefined,
        interests: {
          entities: {
            artists: interests.artists || [],
            movies: interests.movies || [],
            tvShows: interests.tvShows || interests.tv_shows || [],
            brands: interests.brands || [],
            products: interests.products || [],
            places: interests.places || []
          },
          topics: interests.topics || []
        },
        preferences: preferences.priceLevel ? {
          priceLevel: preferences.priceLevel
        } : undefined
      };
      
      // Convert age to ageGroup for Qloo
      if (profile.demographics?.age) {
        const ageStr = profile.demographics.age.toString();
        const age = parseInt(ageStr);
        if (!isNaN(age)) {
          if (age <= 35) profile.demographics.ageGroup = "35_and_younger";
          else if (age <= 55) profile.demographics.ageGroup = "36_to_55";
          else profile.demographics.ageGroup = "55_and_older";
        } else if (ageStr.includes('35_and_younger') || ageStr.includes('young')) {
          profile.demographics.ageGroup = "35_and_younger";
        } else if (ageStr.includes('36_to_55') || ageStr.includes('middle')) {
          profile.demographics.ageGroup = "36_to_55";
        } else if (ageStr.includes('55_and_older') || ageStr.includes('senior')) {
          profile.demographics.ageGroup = "55_and_older";
        }
      }
      
      // Build base demographic signals
      const baseSignals: Record<string, any> = {};
      
      if (profile.demographics?.ageGroup) {
        baseSignals['signal.demographics.age'] = profile.demographics.ageGroup;
        baseSignals['signal.demographics.age.weight'] = 6;
      }
      
      if (profile.demographics?.gender) {
        baseSignals['signal.demographics.gender'] = profile.demographics.gender;
        baseSignals['signal.demographics.gender.weight'] = 5;
      }
      
      if (profile.location?.query) {
        baseSignals['signal.location.query'] = profile.location.query;
        baseSignals['signal.location.weight'] = 7;
      }
      
      if (profile.location?.countryCode) {
        baseSignals['filter.geocode.country_code'] = profile.location.countryCode;
      }

      // Collect all interest terms for entity signals
      //const allInterestTerms: string[] = [];
      //if (profile.interests?.entities) {
      //  Object.values(profile.interests.entities).forEach(items => {
      //    if (Array.isArray(items)) allInterestTerms.push(...items);
      //  });
      //}
 // Collect all interest terms from entities AND general topics
      const entityTerms: string[] = [];
      Object.values(profile.interests.entities).forEach(items => {
        if (Array.isArray(items)) entityTerms.push(...items);
      });
      // topics might include things like "golf", "sports", etc.
      const topicTerms: string[] = profile.interests.topics || [];
      const allInterestTerms: string[] = [...entityTerms, ...topicTerms];

      
      // Add interest signals
      if (allInterestTerms.length > 0) {
        baseSignals['signal.interests.entities.query'] = allInterestTerms;
        baseSignals['signal.interests.entities.weight'] = 8;
      }
      
      if (profile.interests.topics?.length > 0) {
        baseSignals['signal.interests.tags.query'] = profile.interests.topics;
        baseSignals['signal.interests.tags.weight'] = 7;
      }

      // Create queries for all supported entity types
      const queries: QlooInsightQueries = { profile };

      // All Qloo entity types
      const entityTypes = [
        'urn:entity:artist',
        'urn:entity:book', 
        'urn:entity:brand',
        'urn:entity:destination',
        'urn:entity:movie',
        'urn:entity:person',
        'urn:entity:place',
        'urn:entity:podcast',
        'urn:entity:tv_show',
        'urn:entity:videogame'
      ];

      // Generate base query for each entity type
      entityTypes.forEach(entityType => {
        const queryKey = entityType.split(':').pop()!; // Extract 'artist', 'book', etc.
        queries[queryKey] = {
          'filter.type': entityType,
          ...baseSignals,
          'take': 20,
          'feature.explainability': true
        };
      });

      // Add preference filters where applicable (places, destinations, brands)
      if (profile.preferences?.priceLevel) {
        const priceFilters: Record<string, any> = {};
        if (profile.preferences.priceLevel.min) {
          priceFilters['filter.price_level.min'] = profile.preferences.priceLevel.min;
        }
        if (profile.preferences.priceLevel.max) {
          priceFilters['filter.price_level.max'] = profile.preferences.priceLevel.max;
        }
        
        // Apply price filters to relevant entity types
        if (queries.place) Object.assign(queries.place, priceFilters);
        if (queries.destination) Object.assign(queries.destination, priceFilters);
        if (queries.brand) Object.assign(queries.brand, priceFilters);
      }

      return NextResponse.json({
        success: true,
        profile: profile,
        queries: queries,
        // Legacy format for backward compatibility
        legacy: {
          seed_type: "comprehensive",
          seed_terms: allInterestTerms,
          count: allInterestTerms.length,
          demographics: profile.demographics,
          topics: profile.interests.topics
        }
      });
      
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      return NextResponse.json({ 
        error: 'Failed to parse profile data',
        rawContent: content 
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Extract API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
