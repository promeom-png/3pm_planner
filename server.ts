import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { google } from "googleapis";
import cookieParser from "cookie-parser";
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import dotenv from 'dotenv';
import ical from 'node-ical';

dotenv.config();

const app = express();
// En Cloud Run, Google inyecta el puerto en la variable PORT (suele ser 8080).
// En AI Studio, necesitamos que sea el 3000.
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

// Load Firebase config
const firebaseConfig = JSON.parse(
  fs.readFileSync(new URL('./firebase-applet-config.json', import.meta.url), 'utf-8')
);

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

app.use(express.json());
app.use(cookieParser());

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.APP_URL}/api/auth/google/callback`
);

// API routes
app.get("/api/auth/google/url", (req, res) => {
  const userId = req.query.userId as string;
  const email = req.query.email as string;
  if (!userId) return res.status(400).json({ error: "userId is required" });

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(500).json({ error: "Google OAuth credentials are not configured in environment variables" });
  }

  try {
    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: [
        "https://www.googleapis.com/auth/calendar.readonly",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile"
      ],
      state: userId,
      prompt: "consent",
      login_hint: email
    });
    res.json({ url });
  } catch (error) {
    console.error("Error generating auth URL:", error);
    res.status(500).json({ error: "Error al generar la URL de autenticación" });
  }
});

app.get("/api/auth/google/callback", async (req, res) => {
  const { code, state: userId } = req.query;
  if (!code || !userId) return res.status(400).send("Missing code or state");

  try {
    const { tokens } = await oauth2Client.getToken(code as string);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const email = userInfo.data.email;

    if (!email) throw new Error("Could not get user email");

    // Store tokens in Firestore
    const accountId = Buffer.from(email).toString('base64');
    const userPath = `users/${userId}`;
    await setDoc(doc(db, userPath, 'googleAccounts', accountId), {
      id: accountId,
      email: email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: tokens.expiry_date,
      isAuthorized: true
    });

    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Autenticación exitosa. Esta ventana se cerrará automáticamente.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("Error in Google OAuth callback:", error);
    res.status(500).send("Error during authentication");
  }
});

app.get("/api/google-calendar/events", async (req, res) => {
  const { userId, accountId } = req.query;
  if (!userId || !accountId) return res.status(400).json({ error: "userId and accountId are required" });

  try {
    const userPath = `users/${userId}`;
    const accountDoc = await getDoc(doc(db, userPath, 'googleAccounts', accountId as string));
    if (!accountDoc.exists()) return res.status(404).json({ error: "Account not found" });

    const accountData = accountDoc.data();
    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    client.setCredentials({
      access_token: accountData.accessToken,
      refresh_token: accountData.refreshToken,
      expiry_date: accountData.expiryDate
    });

    // Handle token refresh
    client.on('tokens', async (tokens) => {
      if (tokens.refresh_token) {
        await setDoc(doc(db, userPath, 'googleAccounts', accountId as string), {
          refreshToken: tokens.refresh_token
        }, { merge: true });
      }
      if (tokens.access_token) {
        await setDoc(doc(db, userPath, 'googleAccounts', accountId as string), {
          accessToken: tokens.access_token,
          expiryDate: tokens.expiry_date
        }, { merge: true });
      }
    });

    const calendar = google.calendar({ version: "v3", auth: client });
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 3, 0);

    // Fetch all calendars in the user's list
    const calendarList = await calendar.calendarList.list();
    const allEvents: any[] = [];

    // Fetch events from each calendar
    const fetchPromises = (calendarList.data.items || []).map(async (cal) => {
      try {
        const response = await calendar.events.list({
          calendarId: cal.id || 'primary',
          timeMin: startOfMonth.toISOString(),
          timeMax: endOfMonth.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
        });

        const events = response.data.items?.map(item => ({
          id: `google_${item.id}`,
          title: item.summary || '(Sin título)',
          start: item.start?.dateTime || item.start?.date,
          end: item.end?.dateTime || item.end?.date,
          location: item.location,
          category: cal.summary || 'Google Calendar',
          color: cal.backgroundColor || '#ADD8E6',
          googleEventId: item.id,
          googleAccountId: accountId,
          calendarId: cal.id
        })) || [];
        
        return events;
      } catch (err) {
        console.error(`Error fetching events for calendar ${cal.id}:`, err);
        return [];
      }
    });

    const results = await Promise.all(fetchPromises);
    results.forEach(events => allEvents.push(...events));

    res.json(allEvents);
  } catch (error) {
    console.error("Error fetching Google Calendar events:", error);
    res.status(500).json({ error: "Error fetching events" });
  }
});

app.get("/api/calendar/ical", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "url is required" });

  try {
    const data = await ical.async.fromURL(url as string);
    const events = Object.values(data)
      .filter(item => item.type === 'VEVENT')
      .map(item => {
        const event = item as any;
        return {
          id: `ical_${event.uid}`,
          title: event.summary || '(Sin título)',
          start: event.start.toISOString(),
          end: event.end.toISOString(),
          location: event.location,
          category: 'Google Calendar',
          color: '#ADD8E6', // Azul claro
          googleEventId: event.uid
        };
      });
    res.json(events);
  } catch (error) {
    console.error("Error fetching iCal feed:", error);
    res.status(500).json({ error: "Error al obtener el calendario público" });
  }
});

// Vite middleware
if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
