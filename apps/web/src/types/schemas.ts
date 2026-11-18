import { z } from "@/lib/zod"

// The sign-in schemas are the app's; everything else is finance's, re-exported so `@/types/schemas` keeps working.
export * from "@alter-ego/finance/schemas"

export const signInSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

export const signUpSchema = z
  .object({
    email: z.string().email("Please enter a valid email"),
    displayName: z.string().min(1, "Display name is required").max(100),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

export type SignInFormValues = z.infer<typeof signInSchema>
export type SignUpFormValues = z.infer<typeof signUpSchema>
