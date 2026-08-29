# StudyMate AI

StudyMate AI is a grounded lecture assistant that lets students upload a PDF, ask questions in Arabic or English, receive page-level citations, and generate an interactive quiz from the same document.

## Features

- PDF lecture upload with file validation
- Answers limited to the uploaded document
- Page-level citations in the format `[Page N]`
- Arabic and English question support
- Five-question interactive quiz with scoring and explanations
- Automatic retry for temporary model congestion
- Basic request rate limiting and server-side API key protection
- Responsive interface for desktop and mobile

## Technology

- Next.js and TypeScript
- React
- Tailwind CSS
- Gemini API for document understanding
- Vercel for deployment

## How it works

1. The student uploads one PDF lecture.
2. The browser sends the PDF and the student's request to a server-side route.
3. The server securely calls the Gemini API with grounding instructions.
4. StudyMate returns a cited answer or a structured quiz.
5. Quiz scoring happens locally in the browser.

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` from `.env.example`:

   ```env
   GEMINI_API_KEY=your_key_here
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open `http://localhost:3000`.

## Deployment

Import the repository into Vercel, add `GEMINI_API_KEY` as an environment variable, and deploy. The API key must never be committed to the repository.

## Security notes

- The Gemini key is used only in server-side routes.
- Local environment files are excluded from version control.
- PDFs are processed for the current request and are not stored by the application.
- The free deployment version accepts PDFs up to 4 MB.

## Author

Designed and developed by **Yusuf Alaghbari**.
