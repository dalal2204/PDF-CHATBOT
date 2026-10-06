const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const { GoogleGenAI } = require('@google/genai');
const { QdrantClient } = require ('@qdrant/js-client-rest');
require('dotenv').config();

const app = express();

// Allow the local Vite development server to call this API from the browser.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin === 'http://localhost:5173' || origin === 'http://127.0.0.1:5173') {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const upload = multer({ dest: 'uploads/' });

// created instance of GoogleGenAI class and passed the API key from  the environment variable
const ai = new GoogleGenAI({// created client named ai which will connect our code to ai model
  apiKey: process.env.GEMINI_API_KEY,
})  

async function createEmbedding(text) {// will create embedding for the text(chunk) passed to it
    const response = await ai.models.embedContent({
        model: 'gemini-embedding-2',
        contents: text,
    });

    return response.embeddings[0].values; // Return the embedding vector
}

const qdrant = new QdrantClient({// qdrant client instance created to connect our code to qdrant database
    url: process.env.QDRANT_URL, // like we use mongoose to connect to mongodb
    apiKey: process.env.QDRANT_API_KEY,
});
 
function cosineSimilarity(vecA, vecB) {
    let dotProduct=0;
    for(let i=0; i<vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
    }
    return dotProduct; 
}  

app.get('/', (req, res) => {
  res.send('Hey I am Saurabh'); 
});

// creating collection in qdrant db to store the embeddings of the chunks of pdf
app.get('/create-collection', async (req, res) => {
    try {
       await qdrant.createCollection('pdf-docs', {
          vectors: {
              size: 3072, // Size of the embedding vector (depends on the model used)
              distance: 'Cosine' // Distance metric for similarity search
          },
       })
       res.send('Collection created successfully');
    }catch(err){
        res.status(500).send(err);
    }  
  });    



app.post('/upload', upload.single("pdf"), async (req, res) => {
    console.log(req.body);

    try{
      const dataBuffer = fs.readFileSync(req.file.path);// binary data
      const pdfData = await pdfParse(dataBuffer);// converting data into usable(readable) format
      const text = pdfData.text;

      const chunks = text.split('\n\n').filter((chunk) => chunk.trim() !== ''); // splitting the text into chunks based on double newlines i.e paragraphs 

      //const embedding = await createEmbedding(chunks[0]);
      const chunkEmbeddings = [];
      for(const chunk of chunks) {
        const embedding = await createEmbedding(chunk);

        chunkEmbeddings.push({
            text: chunk,
            embedding
        });
      }

      const points = chunkEmbeddings.map((item, index) => ({
          id: index+1,
          vector: item.embedding,
          payload: { 
            text: item.text 
          }
      })) 
      
      await qdrant.upsert('pdf-docs', { points }); // Qdrant expects points inside a PointInsertOperations object

      const question = req.body.question; // Get the question from the request body
      const questionEmbedding = await createEmbedding(question);
      // const matchedChunk = chunks.find((chunk) => chunk.toLowerCase().includes(question.toLowerCase()));

      // let bestChunk = null;// bestMatch
      // let bestScore = -Infinity;  

      // for(const items of chunkEmbeddings) {
      //   const score = cosineSimilarity(questionEmbedding, items.embedding);
      //   if(score > bestScore) {
      //     bestScore = score;
      //     bestChunk = items.text;
      //   }
      // }


      const searchResults = await qdrant.query('pdf-docs', {
          query: questionEmbedding,
          limit: 1, // Get the top 1 most similar chunk
          with_payload: true,
      });
      const bestChunk = searchResults.points[0].payload.text; // Get the text of the most similar chunk

      const response = await ai.models.generateContent({
          model: 'gemini-3.5-flash-lite', // Specify the model you want to use
          contents: `Answer the question using the context: ${bestChunk} and Question is: ${question}`
      })

      res.send(response.text);

    }catch (error) {
      console.log(error);
      res.status(500).send('Error processing PDF');
    } 
    
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
}); 
