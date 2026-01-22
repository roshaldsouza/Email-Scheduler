import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../config/prisma";
import jwt from "jsonwebtoken";

export const authRoutes = Router();

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

authRoutes.post("/google", async (req, res) => {
  const { idToken } = req.body as { idToken?: string };

  if (!idToken) {
    return res.status(400).json({ ok: false, message: "idToken is required" });
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload?.email) {
      return res.status(401).json({ ok: false, message: "Invalid Google token" });
    }

    const user = await prisma.user.upsert({
      where: { email: payload.email },
      update: {
        name: payload.name || payload.email.split("@")[0],
        avatarUrl: payload.picture || "",
      },
      create: {
        email: payload.email,
        name: payload.name || payload.email.split("@")[0],
        avatarUrl: payload.picture || "",
      },
    });

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );

    return res.json({
      ok: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (err) {
    return res.status(401).json({ ok: false, message: "Google auth failed" });
  }
});
