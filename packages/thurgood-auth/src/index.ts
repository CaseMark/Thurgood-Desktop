import type { Plugin } from "@opencode-ai/plugin"

export const thurgoodAuth: Plugin = async () => {
  return {
    auth: {
      provider: "thurgood",
      methods: [
        {
          type: "api",
          label: "Case.dev API Key",
        },
      ],
    },
  }
}

export default thurgoodAuth
