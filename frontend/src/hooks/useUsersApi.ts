import { useQuery } from "@tanstack/react-query";
import { fetchUsers } from "@/api/users";
import { User } from "@/types";

export const usersKeys = {
  all: ["users"] as const,
};

export function useUsersQuery() {
  return useQuery<User[]>({
    queryKey: usersKeys.all,
    queryFn: fetchUsers,
  });
}
