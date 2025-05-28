const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

require('dotenv').config();



const express = require('express');
const axios = require('axios');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const FormData = require('form-data');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

// At the top of your file:
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ASSISTANT_ID   = process.env.ASSISTANT_ID;
 

app.post('/send-message', upload.single('file'), async (req, res) => {
  try {
    const userMessage = req.body.message || '';
    let fileId = null;



    console.log('Uploaded file:', req.file);

    if (req.file) {
      const form = new FormData();
      form.append('file', fs.createReadStream(req.file.path), {
        filename: req.file.originalname
      });
      form.append('purpose', 'assistants');
      
      const uploadRes = await axios.post(
        'https://api.openai.com/v1/files',
        form,
        {
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            ...form.getHeaders()
          }
        }
      );

      fileId = uploadRes.data.id;
      fs.unlinkSync(req.file.path);

      console.log('Uploaded file fileId:', fileId);
    }

    if (!threadId) {
      const threadRes = await axios.post('https://api.openai.com/v1/threads', {}, {
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'OpenAI-Beta': 'assistants=v2' },
      });
      threadId = threadRes.data.id;
    }

    // const messagePayload = {
    //   role: 'user',
    //   content: userMessage,
    // };
    // if (fileId) messagePayload.file_ids = [fileId];


    const messagePayload = {
      role: 'user',
      content: [
        {
          type: 'text',
          text: userMessage || '1. Проверете го прикачениот документ и пронајдете ја листата на интервенции што му биле направени (ова е во точка 5. Направени медицински услуги). 2. Напишете ја секоја од нив во разговорот за да потврдите со корисникот дека се точни. 3. Доколку корисникот потврди дека се точни, за секоја од нив направете класификација какот тип на процедура е. Потоа земајќи ги во предвид, типот на процедурата, нејзината итност и самата процедура проверете дали истата е покриена во документите прикачени во векторската продавница. Проверете ги точките 1.1, 1.2, 1.3 од документите прикачени во векторската продавница.'
        }
      ],
      attachments: fileId ? [
        {
          file_id: fileId,
          tools: [{ type: 'file_search' }] // or code_interpreter, depending on your assistant
        }
      ] : []
    };


    console.log("Payload:", JSON.stringify(messagePayload, null, 2));

    await axios.post(`https://api.openai.com/v1/threads/${threadId}/messages`, messagePayload, {
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'OpenAI-Beta': 'assistants=v2' },
    });

    const run = await axios.post(`https://api.openai.com/v1/threads/${threadId}/runs`, {
      assistant_id: ASSISTANT_ID,
    }, {
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'OpenAI-Beta': 'assistants=v2' },
    });

    let status = 'queued';
    let runData;

    while (status === 'queued' || status === 'in_progress') {
      await new Promise(r => setTimeout(r, 1500));
      runData = await axios.get(`https://api.openai.com/v1/threads/${threadId}/runs/${run.data.id}`, {
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'OpenAI-Beta': 'assistants=v2' },
      });
      status = runData.data.status;
    }

    const messages = await axios.get(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'OpenAI-Beta': 'assistants=v2' },
    });

    const lastAssistantMessage = messages.data.data.find(m => m.role === 'assistant');
    const reply = lastAssistantMessage?.content[0]?.text?.value || '(No reply from assistant)';
    res.json({ reply });
  } catch (err) {
    console.error(err.response?.data);
    res.status(500).json({ reply: 'Something went wrong talking to the assistant.' });
  }
});
app.use(express.static(path.join(__dirname, 'public')));
app.listen(3000, () => console.log('🟢 Server listening on http://localhost:3000'));
