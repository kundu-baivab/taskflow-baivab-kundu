import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { Button } from "@/components/ui/button";
import { LogOut, Moon, Sun, FolderKanban } from "lucide-react";

export function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-xl items-center px-4 mx-auto">
        <Link to="/projects" className="flex items-center gap-2 font-bold text-lg mr-6">
          <FolderKanban className="h-5 w-5 text-primary" />
          TaskFlow
        </Link>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </Button>

          {user && (
            <>
              <span className="text-sm text-muted-foreground hidden sm:inline">{user.name}</span>
              <Button variant="ghost" size="icon" onClick={logout} aria-label="Logout">
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
