# End-to-End Encryption

Whispr uses the **Signal Protocol** to ensure that only the participants in a conversation can read the messages.

## Core Concepts

### X3DH (Extended Triple Diffie-Hellman)
X3DH is used to establish a shared secret key between two users, even if one of them is offline. It uses:
- **Identity Keys**: Long-term stable keys.
- **Signed PreKeys**: Semi-stable keys.
- **One-Time PreKeys**: Single-use keys retrieved from the `auth-service`.

### Double Ratchet Algorithm
Once a session is established, the Double Ratchet algorithm ensures **Forward Secrecy** and **Future Secrecy**:
- **DH Ratchet**: New Diffie-Hellman exchanges are performed regularly.
- **Symmetric Ratchet**: New message keys are derived for every single message.

## The Role of Auth-Service

The `auth-service` acts as a **Key Directory**. It does not participate in encryption but stores public keys so other users can find them:

1. **Key Storage**: Users upload their Public Identity Keys and batches of Public PreKeys.
2. **Key Distribution**: When Alice wants to message Bob, she asks `auth-service` for Bob's "PreKey Bundle".
3. **Multi-Device Support**: `auth-service` tracks keys for *every device* a user owns. A message for "Bob" is actually encrypted multiple times: once for each of Bob's registered devices.

## Multi-Device Synchronization

Since private keys never leave the device where they were generated, each device has its own cryptographic identity.
- When you send a message from your Phone, it is also encrypted for your Tablet.
- The `auth-service` ensures that all devices receive these "sync messages".

---

**Reference:** [Database Keys Mapping](../reference/database-schema.md)
