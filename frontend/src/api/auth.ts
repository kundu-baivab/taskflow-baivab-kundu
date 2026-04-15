import client from "./client";
import { AuthResponse } from "@/types";

export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await client.post<AuthResponse>("/api/auth/login", { email, password });
  return data;
}

export async function register(name: string, email: string, password: string): Promise<AuthResponse> {
  const { data } = await client.post<AuthResponse>("/api/auth/register", { name, email, password });
  return data;
}

export async function logout(): Promise<void> {
  await client.post("/api/auth/logout");
}
