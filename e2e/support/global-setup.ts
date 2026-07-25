import { clerkSetup } from '@clerk/testing/playwright';

/**
 * Publica o "testing token" do Clerk (via CLERK_SECRET_KEY) uma vez por execução da suíte,
 * permitindo que setupClerkTestingToken() em cada teste ignore a detecção de bot do Clerk
 * sem depender de UI de terceiros/captcha.
 */
export default async function globalSetup() {
  await clerkSetup();
}
