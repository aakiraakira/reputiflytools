import { describe, expect, it, vi } from "vitest";
import {
  IdentityToolkitClient,
  authenticate,
  extractBearer,
  type IdentityClient,
  type MembershipReader,
} from "../src/auth";
import { AppError } from "../src/errors";

describe("authentication", () => {
  it("requires a well-formed bearer token", () => {
    expect(() => extractBearer(undefined)).toThrowError(AppError);
    expect(() => extractBearer("Basic abc")).toThrowError(/malformed/);
    expect(extractBearer("Bearer signed-token")).toBe("signed-token");
  });

  it("verifies the legacy identity and active membership", async () => {
    const identityClient: IdentityClient = {
      lookup: vi.fn().mockResolvedValue({
        uid: "legacy-user",
        email: "member@example.com",
        emailVerified: true,
      }),
    };
    const membershipReader: MembershipReader = {
      getMember: vi.fn().mockResolvedValue({ active: true, role: "member", displayName: "Farhan" }),
    };

    await expect(
      authenticate("Bearer good-token", identityClient, membershipReader),
    ).resolves.toMatchObject({
      uid: "legacy-user",
      email: "member@example.com",
      role: "member",
      memberDisplayName: "Farhan",
    });
    expect(identityClient.lookup).toHaveBeenCalledWith("good-token");
    expect(membershipReader.getMember).toHaveBeenCalledWith("legacy-user");
  });

  it("rejects missing and inactive membership documents", async () => {
    const identityClient: IdentityClient = {
      lookup: vi.fn().mockResolvedValue({
        uid: "legacy-user",
        email: "member@example.com",
        emailVerified: true,
      }),
    };
    const membershipReader: MembershipReader = { getMember: vi.fn().mockResolvedValue(null) };

    await expect(
      authenticate("Bearer good-token", identityClient, membershipReader),
    ).rejects.toMatchObject({ status: 403, code: "forbidden" });

    membershipReader.getMember = vi.fn().mockResolvedValue({ active: false, role: "owner" });
    await expect(
      authenticate("Bearer good-token", identityClient, membershipReader),
    ).rejects.toMatchObject({ status: 403, code: "forbidden" });
  });

  it("uses accounts:lookup and does not trust token contents locally", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          users: [{
            localId: "verified-uid",
            email: "verified@example.com",
            emailVerified: true,
          }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const client = new IdentityToolkitClient("public-api-key", fetchMock);

    await expect(client.lookup("opaque-id-token")).resolves.toMatchObject({ uid: "verified-uid" });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toContain("accounts:lookup?key=public-api-key");
    expect(init?.body).toBe(JSON.stringify({ idToken: "opaque-id-token" }));
  });

  it("maps rejected legacy tokens to 401 without exposing provider errors", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "INVALID_ID_TOKEN: sensitive detail" } }), {
        status: 400,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = new IdentityToolkitClient("public-api-key", fetchMock);

    await expect(client.lookup("bad-token")).rejects.toMatchObject({
      status: 401,
      code: "unauthorized",
      message: "The sign-in session is invalid or expired.",
    });
  });
});
