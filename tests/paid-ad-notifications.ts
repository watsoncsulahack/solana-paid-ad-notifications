import * as anchor from "@coral-xyz/anchor";

describe("paid_ad_notifications", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  it("loads provider for local validation", async () => {
    if (!provider.wallet?.publicKey) {
      throw new Error("provider wallet missing");
    }
  });
});
