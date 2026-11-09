import { createMockAdapter, __resetMockState } from "../mock"
import { describeAdapterContract } from "./adapter-contract"

describeAdapterContract("mock", async () => {
  __resetMockState()
  return {
    db: createMockAdapter().db,
    userId: "contract-user-1",
    otherUserId: "contract-user-2",
    cleanup: async () => {
      __resetMockState()
    },
  }
})
