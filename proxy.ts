import { withAuth } from "next-auth/middleware";

export const proxy = withAuth({
  pages: {
    signIn: "/sign-in",
  },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/accounts/:path*",
    "/transactions/:path*",
    "/cards/:path*",
    "/projects/:path*",
    "/settings/:path*",
  ],
};
