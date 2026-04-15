import client from "./client";
import { User } from "@/types";

export async function fetchUsers(): Promise<User[]> {
  const { data } = await client.get<{ users: User[] }>("/api/users");
  return data.users;
}
