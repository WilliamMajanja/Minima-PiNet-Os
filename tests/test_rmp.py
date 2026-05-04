import unittest

from backend.rmp import build_rmp_proof, create_rnpe2_request, verify_rmp_proof, verify_rnpe2_consensus


class RmpTest(unittest.TestCase):
    def test_builds_and_verifies_compressed_target_proof(self):
        state = {
            "chain": {"block": 123, "tip": "0xabc"},
            "network": {"connected": 3},
        }

        proof = build_rmp_proof(state, ["chain.block"])
        result = verify_rmp_proof(proof)

        self.assertEqual(proof["schemaVersion"], "RMP-1")
        self.assertEqual(proof["targetCount"], 1)
        self.assertGreater(proof["omittedLeaves"], 0)
        self.assertTrue(result["valid"])
        self.assertEqual(result["verifiedPaths"], ["chain.block"])

    def test_rejects_tampered_leaf_value(self):
        proof = build_rmp_proof({"chain": {"block": 123}}, ["chain.block"])
        proof["targets"][0]["value"] = 124

        result = verify_rmp_proof(proof)

        self.assertFalse(result["valid"])
        self.assertEqual(result["reason"], "RMP leaf hash mismatch")

    def test_rnpe2_request_and_consensus_compare_roots(self):
        local = build_rmp_proof({"chain": {"block": 9}}, ["chain.block"])
        peer = build_rmp_proof({"chain": {"block": 10}}, ["chain.block"])

        request = create_rnpe2_request(9, 10, local)
        result = verify_rnpe2_consensus(local, peer)

        self.assertEqual(request["schemaVersion"], "RNPE-2")
        self.assertEqual(request["missingBlocks"]["from"], 10)
        self.assertFalse(result["consensusMatch"])


if __name__ == "__main__":
    unittest.main()
