import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  modularizeImports: {
    "lucide-react": {
      transform: "lucide-react/dist/esm/icons/{{ kebabCase member }}",
    },
  },
};

export default nextConfig;
