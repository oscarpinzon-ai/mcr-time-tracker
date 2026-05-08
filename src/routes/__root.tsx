import { Toaster } from "@/components/ui/sonner";
import { Outlet, createRootRoute, HeadContent, Scripts, Link } from "@tanstack/react-router";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "MCR Parts Tracker" },
      { name: "description", content: "Parts tracking dashboard for HouseCall Pro Jobs and Estimates." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:title", content: "MCR Parts Tracker" },
      { name: "twitter:title", content: "MCR Parts Tracker" },
      { property: "og:description", content: "Parts tracking dashboard for HouseCall Pro Jobs and Estimates." },
      { name: "twitter:description", content: "Parts tracking dashboard for HouseCall Pro Jobs and Estimates." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/ec08f626-b1ce-4f42-af15-e1694c01fcff/id-preview-acbad6ec--bf953439-6bcc-4ae3-9167-672a8ae3e57d.lovable.app-1778199830998.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/ec08f626-b1ce-4f42-af15-e1694c01fcff/id-preview-acbad6ec--bf953439-6bcc-4ae3-9167-672a8ae3e57d.lovable.app-1778199830998.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "shortcut icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <>
      {/* Global secondary nav — thin bar linking to every major section */}
      <nav className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-8 flex items-center gap-5 text-xs font-medium">
          <Link
            to="/"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Home
          </Link>
          <span className="text-border select-none">·</span>
          <Link
            to="/admin"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Admin
          </Link>
          <span className="text-border select-none">·</span>
          <Link
            to="/revenue"
            className="text-primary font-semibold hover:text-primary/80 transition-colors"
          >
            Revenue Intel
          </Link>
        </div>
      </nav>
      <Outlet />
      <Toaster richColors position="top-center" />
    </>
  );
}
