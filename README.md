🚀 Overview
GiftsTheyWant.com revolutionizes gift-giving by combining behavioral psychology with advanced AI. Instead of generic recommendations based on demographics, we use semantic understanding to match gifts to the deeper psychology of what people actually want.
The Problem: Traditional gift recommendations rely on crude data that misses what people truly desire.
Our Solution: AI that understands the hidden connections between interests, personality, and products across the entire e-commerce landscape.
✨ Features

🧠 Psychological Understanding: Uses Qloo behavioral insights to decode preference patterns
🎯 Semantic Matching: ChatGPT vector embeddings find products that truly resonate
🔗 Dynamic Affiliate Links: Personalized recommendations that flex based on individual tastes
🛍️ Multi-Retailer Support: Search across Amazon and other catalogs simultaneously
⚡ Real-time Discovery: Sub-second semantic product matching
🎨 Natural Language Input: Describe interests in plain English, get perfect matches

🏗️ Architecture
User Input → ChatGPT NLP → Qloo Entities → Vector Embeddings → PostgreSQL → Product Matches
Our platform processes natural language through multiple AI layers:

ChatGPT extracts topics and interests from user input
Qloo API provides behavioral insights and psychological patterns
Vector embeddings create semantic representations
PostgreSQL vector database stores and queries millions of products
Semantic matching finds products across multiple retailers

🛠️ Tech Stack

Backend: Python
Frontend: TypeScript
Database: PostgreSQL (with vector extensions)
Web Server: Nginx
Cloud: Vultr
AI APIs: ChatGPT, Qloo
Vector Search: Custom semantic similarity engine

🎯 Use Cases
Personal Gift-Giving

Input: "My friend loves hiking and minimalist design"
Output: Curated products that understand the deeper connections (sustainable gear, artisanal coffee, nature photography books)

Dynamic Affiliate Marketing

Traditional: Static product grids shown to everyone
Our Approach: Affiliate links that adapt based on semantic understanding of personal preferences

Enterprise Gifting

Corporate gift programs with personalized recommendations at scale
Employee recognition gifts that actually resonate

🚀 Getting Started
Prerequisites

Python 3.9+
Node.js 16+
PostgreSQL 14+ with vector extensions
ChatGPT API key
Qloo API access

Installation
bash# Clone the repository
git clone https://github.com/yourusername/giftstheywant.git
cd giftstheywant

# Install backend dependencies
pip install -r requirements.txt

# Install frontend dependencies  
npm install

# Set up environment variables
cp .env.example .env
# Add your API keys and database credentials

# Run database migrations
python manage.py migrate

# Start the development server
python manage.py runserver
Environment Variables
env# Database
DATABASE_URL=postgresql://user:password@localhost:5432/giftstheywant

# AI APIs
OPENAI_API_KEY=your_chatgpt_api_key
QLOO_API_KEY=your_qloo_api_key
QLOO_API_SECRET=your_qloo_api_secret

# Server Configuration
DEBUG=True
SECRET_KEY=your_secret_key

Website: giftstheywant.com
