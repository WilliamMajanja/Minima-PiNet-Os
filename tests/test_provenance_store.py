import unittest

from backend.provenance_store import get_provenance_events, record_provenance_event


class ProvenanceStoreTest(unittest.TestCase):
    def test_metadata_fields_are_preserved_outside_payload(self):
        event = record_provenance_event(
            {
                "eventType": "STATE_CHANGE",
                "clusterId": "cluster-a",
                "nodeId": "node-a",
                "payload": {"description": "updated"},
                "operator": "release-test",
            },
            source="test",
        )

        self.assertEqual(event["schemaVersion"], "RMPE-2")
        self.assertEqual(event["metadata"]["operator"], "release-test")
        self.assertEqual(event["metadata"]["clusterId"], "cluster-a")
        self.assertEqual(event["payload"], {"description": "updated"})
        self.assertTrue(event["rmpeHash"].startswith("sha256:"))

    def test_events_are_hash_chained(self):
        first = record_provenance_event({"eventType": "WORKLOAD_SUBMIT"}, source="test")
        second = record_provenance_event({"eventType": "WORKLOAD_COMPLETE"}, source="test")

        self.assertEqual(second["previousHash"], first["rmpeHash"])
        self.assertIn(second, get_provenance_events())


if __name__ == "__main__":
    unittest.main()
