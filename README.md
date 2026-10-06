# Papertrail — PDF document assistant

Papertrail is a document Q&A application built around the existing Gemini and Qdrant stack. PDFs are uploaded once, indexed for retrieval, and then available for repeated document-specific conversations.

## Features

- Upload and manage multiple PDFs.
- Store PDF files in Cloudinary and document metadata in MongoDB.
- Extract and overlap-chunk PDF text, embed it with Gemini, and store vectors in Qdrant.
- Filter vector retrieval by the selected MongoDB document ID.
- Persist chat exchanges and display the selected document's history after refresh.
- Delete a document together with its vectors, PDF, and conversation history.
- Responsive React interface using Tailwind CSS v4.3.

## Stack and architecture

```text
React + Vite + Tailwind
        │ /api
        ▼
Express routes → controllers → document / chat services
        ├── MongoDB (documents, conversations)
        ├── Cloudinary (PDF files)
        ├── Gemini (text embeddings and answer generation)
        └── Qdrant (document-filtered chunk vectors)
```

```text
server/
  config/         MongoDB, Cloudinary, Gemini, Qdrant clients
  controllers/    HTTP request handlers
  middlewares/    in-memory PDF upload and error handling
  models/         Document and Chat schemas
  routes/         Health, document, and document-chat endpoints
  services/       PDF, embedding, AI, vector, cloud storage, lifecycle
  utils/          chunking, async handler, API errors
  index.js
Frontend/
  src/services/   API client
  src/App.jsx     document library and chat UI
  src/index.css   Tailwind and responsive styles
```

## RAG workflow

1. The API validates a PDF (20 MB limit) and streams it from memory to Cloudinary.
2. MongoDB creates a `processing` document record.
3. `pdf-parse` extracts text; text is split into chunks with overlap.
4. Gemini generates a vector for each chunk. Qdrant stores the vector with `documentId`, `chunkIndex`, and chunk text in its payload.
5. MongoDB marks the document `ready`.
6. A chat question is embedded and Qdrant searches with a mandatory `documentId` filter.
7. Gemini answers using the retrieved excerpts, and the question, answer, and source excerpts are saved to MongoDB.

The existing `pdf-docs` collection is reused by default and checked for the configured vector size. If it is missing, the API creates it lazily. Embeddings are not regenerated for chat requests.

## API

All endpoints are prefixed with `/api`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/health` | API and MongoDB status |
| POST | `/documents` | Upload a PDF (`multipart/form-data`, field `pdf`) |
| GET | `/documents` | List documents |
| GET | `/documents/:id` | Get document metadata |
| DELETE | `/documents/:id` | Delete document and associated resources |
| POST | `/documents/:documentId/chat` | Ask a question (`{ "question": "..." }`) |
| GET | `/documents/:documentId/chat` | List chat history |
| DELETE | `/documents/:documentId/chat` | Clear chat history |

Responses use `{ "success": true, "data": ... }`; errors use `{ "success": false, "message": ... }`.

## Configure external services

Copy `server/.env.example` to `server/.env` and provide:

- **MongoDB:** `MONGO_URI` for a database reachable from this machine.
- **Gemini:** `GEMINI_API_KEY`; the model names can be changed using `GEMINI_EMBEDDING_MODEL` and `GEMINI_CHAT_MODEL`.
- **Qdrant:** `QDRANT_URL`, `QDRANT_API_KEY`, and the embedding vector size. Collection defaults to `pdf-docs`; collection and size are controlled by `QDRANT_COLLECTION` and `QDRANT_VECTOR_SIZE`.
- **Cloudinary:** `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`.
- **CORS:** `CLIENT_ORIGIN` is a comma-separated list of frontend origins.

The embedding vector size must match the selected Gemini embedding model's output. The default is 3072 to preserve the existing project's Qdrant configuration. For a fresh or reused collection with another size, set `QDRANT_VECTOR_SIZE` to the model's actual dimension and use a matching collection.

Copy `Frontend/.env.example` to `Frontend/.env` only if the API URL differs from `http://localhost:3000/api`. Frontend variables must be public configuration only. Never place server API credentials in the frontend environment.

## Run locally

Install dependencies in each project directory, then start the API and UI in separate terminals:

```powershell
cd server
npm install
npm run dev
```

```powershell
cd Frontend
npm install
npm run dev
```

Open the Vite URL printed in the frontend terminal. For a production frontend build, run `npm run build` in `Frontend`.

## Example workflow

1. Configure MongoDB, Gemini, Qdrant, and Cloudinary in `server/.env`.
2. Start both applications and upload a text-based PDF from the document library.
3. Select the ready document, ask questions, and revisit the conversation after refresh.
4. Delete the document from its library menu to remove its stored file, chunks, metadata, and chats.

## Design notes

- The backend uses memory-backed Multer uploads, so PDFs are not retained under `server/uploads`.
- Qdrant points use UUIDs to avoid collisions between documents.
- Document operations are currently unauthenticated and intended for a single-user/personal deployment. Add authentication and ownership checks before exposing this API to multiple users.
- Scanned/image-only PDFs are rejected with a clear message; OCR is not included.
- Processing failures keep a `failed` document record with a user-safe error and attempt to clear partial vectors. The uploaded PDF remains associated with the failed record so deleting it can clean up Cloudinary.
- Deletion attempts cleanup across Cloudinary, Qdrant, and chat history before removing the MongoDB document. If a remote cleanup fails, the document record remains so cleanup can be retried.
- The architecture takes inspiration from StudyForge's separation of document processing, chat, and persistence responsibilities while retaining this project's Gemini and Qdrant stack.
