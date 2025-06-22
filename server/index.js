import { config as _config } from "dotenv";
import express, { json } from "express";
import multer from "multer";
import fs from "fs";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";

_config();
const app = express();
app.use(json());
app.use(cors());

const genAI = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY,
});

const upload = multer({ dest: "uploads/" });
const model = "gemini-2.0-flash";

const deleteUploadedFile = (filePath) => {
  fs.unlinkSync(filePath, (err) => {
    if (err) {
      console.error("Error deleting file:", err);
    }
  });
};

app.get("/", (req, res) => {
  res.json({
    info: "Welcome to Gemini AI API server",
    usage: "Use POST endpoints below to interact with Gemini models",
    endpoints: [
      {
        method: "POST",
        path: "/generate-text",
        description: "Generate text based on a prompt",
        body: {
          prompt: "string (required)",
        },
      },
      {
        method: "POST",
        path: "/generate-from-image",
        description: "Generate text based on an image and optional prompt",
        formData: {
          prompt: "string (optional)",
          image: "file (required)",
        },
      },
      {
        method: "POST",
        path: "/generate-from-document",
        description: "Summarize the uploaded document with optional prompt",
        formData: {
          prompt: "string (optional)",
          document: "file (required)",
        },
      },
      {
        method: "POST",
        path: "/generate-from-audio",
        description: "Transcribe audio file to text with optional prompt",
        formData: {
          prompt: "string (optional)",
          audio: "file (required)",
        },
      },
      {
        method: "POST",
        path: "/chat",
        description: "Interactive chat with context from previous messages",
        body: {
          message: "string (required)",
          history: [
            {
              role: "user | model (required)",
              text: "string (required)",
            },
          ],
          historyLimit: "integer (optional, default: 10)",
        },
      },
    ],
  });
});

app.post("/generate-text", async (req, res) => {
  if (!req.body) {
    return res.status(400).json({ error: "No body provided" });
  }
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }
    const result = await genAI.models.generateContent({
      model,
      config: {
        temperature: 0.5,
      },
      contents: [
        {
          text: prompt,
        },
      ],
    });
    const text = result.text;
    res.json({ output: text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/generate-from-image", upload.single("image"), async (req, res) => {
  const prompt = req.body.prompt || "Describe the image";
  const buffer = fs.readFileSync(req.file.path);
  const base64Data = buffer.toString("base64");
  deleteUploadedFile(req.file.path);
  const mimeType = req.file.mimetype || "image/png";
  const imagePart = {
    inlineData: {
      data: base64Data,
      mimeType,
    },
  };
  if (!req.file) {
    return res.status(400).json({ error: "No image file provided" });
  }
  try {
    const result = await genAI.models.generateContent({
      model,
      config: {
        // temperature: 0.5,
      },
      contents: [
        {
          text: prompt,
        },
        imagePart,
      ],
    });
    const text = result.text;
    res.json({ output: text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post(
  "/generate-from-document",
  upload.single("document"),
  async (req, res) => {
    const prompt = req.body.prompt || "Summarize the document";
    const buffer = fs.readFileSync(req.file.path);
    deleteUploadedFile(req.file.path);
    const base64Data = buffer.toString("base64");
    const mimeType = req.file.mimetype || "application/pdf";
    if (!req.file) {
      return res.status(400).json({ error: "No document file provided" });
    }
    try {
      const documentPart = {
        inlineData: {
          data: base64Data,
          mimeType,
        },
      };
      const result = await genAI.models.generateContent({
        model,
        config: {
          // temperature: 0.5,
        },
        contents: [
          {
            text: prompt,
          },
          documentPart,
        ],
      });
      const text = result.text;
      res.json({ output: text });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

app.post("/generate-from-audio", upload.single("audio"), async (req, res) => {
  const prompt = req.body.prompt || "Transcribe the audio";
  const buffer = fs.readFileSync(req.file.path);
  deleteUploadedFile(req.file.path);
  const base64Data = buffer.toString("base64");
  const mimeType = req.file.mimetype || "audio/mpeg";
  const audioPart = {
    inlineData: {
      data: base64Data,
      mimeType,
    },
  };
  if (!req.file) {
    return res.status(400).json({ error: "No audio file provided" });
  }
  try {
    const result = await genAI.models.generateContent({
      model,
      config: {
        // temperature: 0.5,
      },
      contents: [
        {
          text: prompt,
        },
        audioPart,
      ],
    });
    const text = result.text;
    res.json({ output: text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/chat", async (req, res) => {
  const { message, history = [], historyLimit = 10 } = req.body;

  if (typeof message !== "string" || message.trim() === "") {
    return res
      .status(400)
      .json({ error: "Message is required and must be a non-empty string." });
  }

  const isValidHistory =
    Array.isArray(history) &&
    history.every((msg) => {
      return (
        typeof msg === "object" &&
        msg !== null &&
        (msg.role === "user" || msg.role === "model") &&
        typeof msg.text === "string" &&
        msg.text.trim() !== ""
      );
    });

  if (!isValidHistory && history.length > 0) {
    return res.status(400).json({
      error:
        "Invalid history format. Each message must be an object with 'role' ('user' or 'model') and non-empty 'text'.",
    });
  }

  try {
    const recentHistory = history.slice(-historyLimit);

    const formattedHistory = recentHistory.map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.text }],
    }));

    const chat = genAI.chats.create({
      model,
      history: formattedHistory,
    });

    const response = await chat.sendMessage({
      message,
    });

    const responseText = response.text;
    res.json({ output: responseText });
  } catch (error) {
    console.error("Error in /chat:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
