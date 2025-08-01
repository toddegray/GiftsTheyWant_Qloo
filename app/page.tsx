"use client";

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, ArrowRight, ExternalLink } from "lucide-react"
//import { Navigation } from "@/components/navigation"

// Force this to be a client component to avoid prerendering issues
export const dynamic = 'force-dynamic'

interface ApiResponse {
  success?: boolean
  queries?: {
    artist?: Record<string, any>
    book?: Record<string, any>
    brand?: Record<string, any>
    destination?: Record<string, any>
    movie?: Record<string, any>
    person?: Record<string, any>
    place?: Record<string, any>
    podcast?: Record<string, any>
    tv_show?: Record<string, any>
    videogame?: Record<string, any>
  }
  legacy?: {
    seed_terms?: string[]
  }
  error?: string
}

interface Product {
  id: number
  title: string
  product_url: string
  image_url: string
  price: string
  similarity: number
}

interface ProductResult {
  recommendation: {
    name: string
    affinity: number
    entityType: string
  }
  matches: Product[]
  matchCount: number
}

export default function HomePage() {
  const [userInput, setUserInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProgress, setLoadingProgress] = useState("")
  const [hasResults, setHasResults] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const API_BASE = "https://giftstheywant.com"

  // helper to pause between requests
  const delay = (ms: number) => new Promise(res => setTimeout(res, ms))

  useEffect(() => {
    // Ensure video plays on load
    if (videoRef.current) {
      videoRef.current.play().catch(console.error)
    }
  }, [])

  const handleSubmit = async () => {
    if (!userInput.trim()) {
      return
    }

    setIsLoading(true)
    setHasResults(true)
    setProducts([]) // Clear previous products
    setLoadingProgress("Analyzing preferences...")

    try {
      // 1. Extract seed terms via ChatGPT proxy
      const extractRes = await fetch(`${API_BASE}/api/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: userInput }),
      })

      const extractData: ApiResponse = await extractRes.json()
console.log("👉 Extracted data:", JSON.stringify(extractData, null, 2))

// ─── IMMEDIATE SEED-ONLY VECTORSEARCH ────────────────────────────────
  const seedTerms: string[] = extractData.legacy?.seed_terms || []
console.log("🔑 seedTerms to search:", seedTerms)
  if (seedTerms.length > 0) {
    setLoadingProgress("🔍 Searching your primary interests…")

    // build the shape your API expects
    const seedHits = seedTerms.map(name => ({
      name,
      affinity: 1,
      entityType: "seedTerm",
    }))
console.log("💥 seedHits payload:", seedHits)

    const seedRes = await fetch("/api/vectorsearch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topRecommendations: seedHits,
        topK: 10,  // show one result per seed
      }),
    })

    if (seedRes.ok) {
      const seedData = await seedRes.json()
console.log("🎯 seed vector results:", JSON.stringify(seedData, null, 2))
      if (seedData.success) {
        // flatten to your Product[]
        const seedProducts: Product[] = []
        seedData.results.forEach((r: ProductResult) =>
          r.matches.forEach(p =>
            seedProducts.push({ ...p, recommendation: r.recommendation } as any)
          )
        )
        // render them immediately
        setProducts(seedProducts)
      }
    }
    // then continue on to the insights loop…
 }
      
      // Debug logging (commented out)
      // console.log('Extract data:', JSON.stringify(extractData, null, 2))

      if (!extractRes.ok || extractData.error) {
        setLoadingProgress(`Extraction error: ${extractData.error || extractRes.status}`)
        return
      }

      // Handle new JSON structure - query ALL entity types
      if (extractData.success && extractData.queries) {
        const entityTypes = [
          "artist", "book", "brand", "destination", "movie",
          "person", "place", "podcast", "tv_show", "videogame",
        ]

        setLoadingProgress(`Querying ${entityTypes.length} categories for recommendations...`)

        // Sequentially fetch each entity type with rate limiting
        const insightsResults: Array<{
          entityType: string
          results: any[]
          url: string
        }> = []

        for (const entityType of entityTypes) {
          // wait between 100ms and 250ms before each request
          await delay(Math.random() * 150 + 100)

          const query =
            extractData.queries![entityType as keyof typeof extractData.queries]
          if (!query) continue

          const queryParams = new URLSearchParams()
          Object.entries(query).forEach(([key, value]) => {
            if (Array.isArray(value)) {
              queryParams.set(key, value.join(","))
            } else {
              queryParams.set(key, value.toString())
            }
          })

          const url = `${API_BASE}/api/insights?${queryParams.toString()}`
          try {
            const insRes = await fetch(url)
            const insData = await insRes.json()
            insightsResults.push({
              entityType,
              results: insData.results || [],
              url,
            })
          } catch (error) {
            console.error(`Error fetching ${entityType}:`, error)
          }
        }

        const validInsights = insightsResults

        // Combine all results
        const combinedResults = validInsights.flatMap((insight) =>
          insight.results.map((result: any) => ({
            name: result.name || result.title,
            affinity: result.affinity,
            entityType: insight.entityType,
          }))
        )

        // Debug logging (commented out)
        // console.log(`🔍 Combined results before sort: ${combinedResults.length} items`)
        // console.log(`📊 By category:`, validInsights.map(v => `${v.entityType}: ${v.results.length}`))

        // Sort by affinity descending
        combinedResults.sort((a, b) => b.affinity - a.affinity)

        // Debug logging (commented out)
        // console.log(`📈 After sorting: ${combinedResults.length} items`)
        // console.log(`🏆 Top 5:`, combinedResults.slice(0, 5).map(r => `${r.name} (${r.affinity.toFixed(3)})`))

        const recommendationsData = {
          summary: `Found ${combinedResults.length} total recommendations across ${validInsights.length} categories`,
          byCategory: validInsights.map((insight) => ({
            entityType: insight.entityType,
            count: insight.results.length,
          })),
          topRecommendations: combinedResults, // All recommendations, already sorted by affinity
          allResults: combinedResults,
        }

        // Pull out whatever terms we extracted originally (legacy format)
	//const seedTerms: string[] = extractData.legacy?.seed_terms || []
	//if (seedTerms.length) {
	  // Map them into the same shape as our insight hits
	//  const seedHits = seedTerms.map(name => ({
	//    name,
	//    affinity: 1,             // highest priority
	//    entityType: "seedTerm",
	//  }))

	  // Stick them at the front of the array
	//  recommendationsData.topRecommendations = [
	//    ...seedHits,
	//    ...recommendationsData.topRecommendations,
	//  ]
	//}

        // 2. Now call the vector search API with lazy loading
        if (recommendationsData.topRecommendations.length > 0) {
          setLoadingProgress("Starting product search...")
          
          try {
            let allResults: ProductResult[] = [];
            let startIndex = 0;
            const batchSize = 20;
            const totalRecommendations = recommendationsData.topRecommendations.length;
            
            // Debug logging (commented out)
            // console.log(`🚀 LAZY LOADING: ${totalRecommendations} total recommendations`);
            
            // Process ALL recommendations in batches of 20
            while (startIndex < totalRecommendations) {
              const batchNumber = Math.floor(startIndex / batchSize) + 1;
              const totalBatches = Math.ceil(totalRecommendations / batchSize);
              
              // Debug logging (commented out)
              // console.log(`📦 Processing batch ${batchNumber}/${totalBatches}, startIndex: ${startIndex}`);
              
              setLoadingProgress(
                `🔍 Processing batch ${batchNumber}/${totalBatches}...\n` +
                `Found products...`
              );
              
              // Get the current batch of recommendations to send
              const currentBatch = recommendationsData.topRecommendations.slice(startIndex, startIndex + batchSize);
              
              // Debug logging (commented out)
              // console.log(`📋 Sending batch of ${currentBatch.length} recommendations (${startIndex} to ${startIndex + currentBatch.length - 1})`);
              
              const batchResponse = await fetch('/api/vectorsearch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  topRecommendations: currentBatch, // Send only the current batch
                  topK: 5,
                  startIndex: 0, // Always 0 since we're sending a subset
                  batchSize: currentBatch.length
                })
              });

              if (!batchResponse.ok) {
                throw new Error(`HTTP error! status: ${batchResponse.status}`);
              }

              const batchData = await batchResponse.json();
              
              if (batchData.success) {
                allResults = [...allResults, ...batchData.results];
                
                // Add new products to the display immediately (lazy loading!)
                const newProducts: Product[] = [];
                batchData.results.forEach((result: ProductResult) => {
                  result.matches.forEach((product: Product) => {
                    newProducts.push({
                      ...product,
                      // Add recommendation context for display
                      recommendation: result.recommendation
                    } as any);
                  });
                });
                
                setProducts(prevProducts => [...prevProducts, ...newProducts]);
                
                const progress = Math.round(((startIndex + currentBatch.length) / totalRecommendations) * 100);
                
                setLoadingProgress(
                  `📊 Batch ${batchNumber}/${totalBatches} complete! (${progress}%)\n` +
                  `🎯 Found ${products.length + newProducts.length} products total\n\n` +
                  `${startIndex + currentBatch.length < totalRecommendations ? '⏳ Loading more products...' : '✅ All products loaded!'}`
                );
                
                // Move to next batch
                startIndex += currentBatch.length;
                
                // Debug logging (commented out)
                // console.log(`➡️  Updated startIndex: ${startIndex}, totalRecommendations: ${totalRecommendations}`);
                // console.log(`🔄  Loop condition: ${startIndex} < ${totalRecommendations} = ${startIndex < totalRecommendations}`);
                
              } else {
                console.error(`❌ Batch failed:`, batchData);
                throw new Error(`Batch error: ${batchData.error}`);
              }
              
              // Short delay between batches
              if (startIndex < totalRecommendations) {
                // Debug logging (commented out)
                // console.log(`⏳ Waiting 1 second before next batch...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
            
            // Final summary
            // Debug logging (commented out)
            // console.log(`🎉 LAZY LOADING COMPLETE: ${products.length} products across ${allResults.length} categories`);
            
            setLoadingProgress(
              `🎉 Complete!`
            );
            
          } catch (error) {
            console.error('Lazy loading error:', error);
            setLoadingProgress(`❌ Error loading products: ${(error as Error).message}`);
          }
        } else {
          setLoadingProgress("No recommendations found to search for products");
        }

      } else {
        // Fallback to legacy format
        setLoadingProgress("Legacy format not supported for product search");
      }
    } catch (error) {
      console.error("Error:", error)
      setLoadingProgress(`Network error: ${(error as Error).message}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
     {/* <Navigation />*/}

      {/* Hero Section with Video Background */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Video Background */}
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/gift-hsdpw9LpwFbKKxCFFuOzBhsbEfz539.mp4"
            type="video/mp4"
          />
        </video>

        {/* Warm gradient overlay - more subtle */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-800/50 via-pink-700/40 to-orange-500/45" />


        {/* Content */}
        <div className="relative z-10 text-center text-white max-w-4xl mx-auto px-6 py-32">
          <h1 className="font-serif text-7xl md:text-8xl font-light mb-8 tracking-tight drop-shadow-2xl text-shadow-strong">
            Gifts They Want
          </h1>
          <p className="font-sans text-xl md:text-2xl font-light mb-12 opacity-95 max-w-2xl mx-auto leading-relaxed drop-shadow-lg text-shadow-medium">
            AI-powered gift discovery that understands what they truly desire
          </p>

          <div className="max-w-2xl mx-auto">
            <div className="relative mb-8">
              <Textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="Describe the person you're shopping for - their age, interests, hobbies, style, or anything that makes them unique. For example: 'My 28-year-old sister loves yoga, craft beer, vintage clothing, and her golden retriever...'"
                className="w-full h-32 bg-white/90 backdrop-blur-sm text-gray-800 placeholder:text-gray-600 border border-white/50 text-lg p-6 rounded-none focus:bg-white/95 focus:border-white/70 focus:ring-0 transition-all duration-300 font-sans resize-none shadow-2xl"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    handleSubmit()
                  }
                }}
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={isLoading || !userInput.trim()}
              className="text-white font-medium px-12 py-4 text-lg rounded-none transition-all duration-300 disabled:opacity-50 font-sans shadow-lg hover:shadow-xl border-0"
              style={{
                backgroundColor: "#14B8A6",
                boxShadow: "0 10px 25px rgba(20, 184, 166, 0.4)",
                opacity: "1",
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = "#0D9488"
                e.target.style.boxShadow = "0 15px 35px rgba(20, 184, 166, 0.5)"
                e.target.style.opacity = "1"
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = "#14B8A6"
                e.target.style.boxShadow = "0 10px 25px rgba(20, 184, 166, 0.4)"
                e.target.style.opacity = "1"
              }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                  Analyzing
                </>
              ) : (
                <>
                  Find Their Perfect Gift
                  <ArrowRight className="ml-3 h-5 w-5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </section>

      {/* Results Section */}
      {hasResults && (
        <section className="py-24 bg-gray-50 min-h-screen">
          <div className="max-w-7xl mx-auto px-6">
            
            {/* Loading Progress */}
            <div className="text-center mb-16">
              <h2 className="font-serif text-4xl md:text-5xl font-light mb-6 text-gray-900">
                {isLoading ? "Finding Perfect Gifts..." : "Gift Recommendations"}
              </h2>
              
              {isLoading && (
                <div className="flex items-center justify-center gap-3 mb-6">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  <span className="text-lg text-gray-600">Discovering products...</span>
                </div>
              )}
              
              {/* Progress Text */}
              <div className="bg-white rounded-lg p-6 shadow-sm max-w-2xl mx-auto">
                <pre className="text-sm text-gray-600 whitespace-pre-wrap font-sans">
                  {loadingProgress}
                </pre>
              </div>
            </div>

{/* Products Grid */}
{products.length > 0 && (
  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
    {products.map((product) => (
      <div 
        key={product.id} // stable key
        onClick={() => window.open(product.product_url, '_blank', 'noopener,noreferrer')}
        className="bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer group overflow-hidden border border-gray-200 hover:border-gray-300"
      >
        {/* Product Image */}
        <div className="aspect-square bg-gray-100 overflow-hidden">
          <img
            src={product.image_url}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y3ZjdmNyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTk5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBOb3QgRm91bmQ8L3RleHQ+PC9zdmc+'
            }}
          />
        </div>

        {/* Product Info */}
        <div className="p-4">
          <h3 className="font-medium text-gray-900 text-sm line-clamp-2 mb-2 group-hover:text-blue-600 transition-colors">
            {product.title}
          </h3>

<div className="flex items-center justify-between mb-2">
  <div className="text-lg font-bold">
    {(() => {
      const priceNum = parseFloat(product.price as any);
      if (!isNaN(priceNum)) {
        return (
          <span className="text-green-600">
            ${priceNum.toFixed(2)}
          </span>
        );
      } else {
        return (
          <span className="text-gray-500 italic">
            Click to see price
          </span>
        );
      }
    })()}
  </div>
  <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
</div>

          {/* Entity Type */}
          <div className="flex items-center justify-between text-xs text-gray-500">
           {(product as any).recommendation && (
              <span className="text-blue-600 font-medium">
               {/* {(product as any).recommendation.entityType}*/}
              </span>
            )}
          </div>

          {/* Related to */}
          {(product as any).recommendation && (
            <div className="mt-2 text-xs text-gray-400 line-clamp-1">
             {/* Related to: {(product as any).recommendation.name}*/}
            </div>
          )}
        </div>

      </div>
    ))}
  </div>
)}

{/* Bottom loading indicator / spinner */}
{isLoading && products.length > 0 && (
  <div className="mt-8 flex flex-col items-center justify-center gap-2">
    <div className="flex items-center gap-3">
      <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      <span className="text-lg text-gray-600">Loading more products...</span>
    </div>
    <p className="text-sm text-gray-500">Scroll down or wait — more recommendations are being fetched.</p>
  </div>
)}

            {/* No products message when loading is complete */}
            {!isLoading && products.length === 0 && hasResults && (
              <div className="text-center py-16">
                <p className="text-xl text-gray-600">
                  No products found. Try adjusting your preferences.
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* About Section */}
      <section className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="font-serif text-4xl md:text-5xl font-light mb-8 text-gray-900">
            Advanced AI Gift Discovery
          </h2>
          <p className="font-sans text-xl text-gray-600 leading-relaxed mb-8">
            We leverage Qloo insights to match current interests with other likely interests, then use advanced LLM
            models to match those preferences to our curated database of items through semantic similarity analysis.
          </p>
          <p className="font-sans text-lg text-gray-500 leading-relaxed">
            This sophisticated approach goes beyond simple keyword matching to understand the deeper connections between
            interests, preferences, and the perfect gift recommendations that truly resonate.
          </p>
        </div>
      </section>
    </div>
  )
}
