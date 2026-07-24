from __future__ import annotations
import hashlib
import json
import struct
import time
from typing import Optional
from .config import MARKETPLACE_MAX_LISTINGS

LISTINGS: dict[str, dict] = {}
ORDERS: dict[str, dict] = {}
RATINGS: dict[str, list[dict]] = {}

def _generate_id(prefix: str) -> str:
    ts = int(time.time() * 1000)
    return f"{prefix}-{ts}-{hashlib.sha256(struct.pack('!d', time.time())).hexdigest()[:8]}"

async def create_listing(
    node_id: str,
    name: str,
    description: str = "",
    cpu_cores: int = 4,
    ram_gb: int = 8,
    disk_gb: int = 100,
    gpu_type: str = "",
    npu_type: str = "hailo-8l",
    price_per_hour: str = "0.01",
    token: str = "minima",
    location: str = "",
    tags: list[str] | None = None,
    max_lease_hours: int = 720,
) -> dict:
    if len(LISTINGS) >= MARKETPLACE_MAX_LISTINGS:
        raise RuntimeError(f"Max listings ({MARKETPLACE_MAX_LISTINGS}) reached")
    lid = _generate_id("lst")
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    listing = {
        "listingId": lid,
        "nodeId": node_id,
        "name": name,
        "description": description,
        "cpuCores": cpu_cores,
        "ramGb": ram_gb,
        "diskGb": disk_gb,
        "gpuType": gpu_type,
        "npuType": npu_type,
        "pricePerHour": price_per_hour,
        "token": token,
        "location": location,
        "status": "active",
        "uptimePct": 99.0,
        "ratingAvg": 0.0,
        "ratingCount": 0,
        "tags": tags or [],
        "maxLeaseHours": max_lease_hours,
        "createdAt": now,
    }
    LISTINGS[lid] = listing
    return listing

async def get_listing(listing_id: str) -> Optional[dict]:
    return LISTINGS.get(listing_id)

async def list_listings(
    status: str = "",
    min_ram: int = 0,
    node_id: str = "",
    tags: list[str] | None = None,
) -> list[dict]:
    results = LISTINGS.values()
    if status:
        results = [l for l in results if l["status"] == status]
    if min_ram:
        results = [l for l in results if l["ramGb"] >= min_ram]
    if node_id:
        results = [l for l in results if l["nodeId"] == node_id]
    if tags:
        results = [l for l in results if any(t in l["tags"] for t in tags)]
    return list(results)

async def update_listing_status(listing_id: str, status: str) -> dict:
    l = LISTINGS.get(listing_id)
    if not l:
        raise KeyError(f"Listing {listing_id} not found")
    l["status"] = status
    return l

async def delete_listing(listing_id: str) -> bool:
    return LISTINGS.pop(listing_id, None) is not None

async def create_order(
    listing_id: str,
    buyer_node_id: str,
    seller_node_id: str,
    hours: int = 1,
    token: str = "minima",
) -> dict:
    listing = LISTINGS.get(listing_id)
    if not listing:
        raise KeyError(f"Listing {listing_id} not found")
    oid = _generate_id("ord")
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    price = float(listing["pricePerHour"]) * hours
    escrow = hashlib.sha256(f"{oid}:{buyer_node_id}:{seller_node_id}:{price}".encode()).hexdigest()
    order = {
        "orderId": oid,
        "listingId": listing_id,
        "buyerNodeId": buyer_node_id,
        "sellerNodeId": seller_node_id,
        "hours": hours,
        "totalPrice": f"{price:.6f}",
        "token": token,
        "status": "pending",
        "escrowTxid": f"0x{escrow[:64]}",
        "attestationRef": "",
        "createdAt": now,
        "completedAt": "",
    }
    ORDERS[oid] = order
    return order

async def get_order(order_id: str) -> Optional[dict]:
    return ORDERS.get(order_id)

async def list_orders(node_id: str = "") -> list[dict]:
    if node_id:
        return [o for o in ORDERS.values() if o["buyerNodeId"] == node_id or o["sellerNodeId"] == node_id]
    return list(ORDERS.values())

async def complete_order(order_id: str) -> dict:
    o = ORDERS.get(order_id)
    if not o:
        raise KeyError(f"Order {order_id} not found")
    o["status"] = "completed"
    o["completedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    return o

async def cancel_order(order_id: str) -> dict:
    o = ORDERS.get(order_id)
    if not o:
        raise KeyError(f"Order {order_id} not found")
    o["status"] = "cancelled"
    return o

async def create_rating(
    listing_id: str,
    order_id: str,
    reviewer_node_id: str,
    score: int = 5,
    review: str = "",
) -> dict:
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    rating = {
        "listingId": listing_id,
        "orderId": order_id,
        "reviewerNodeId": reviewer_node_id,
        "score": max(1, min(5, score)),
        "review": review,
        "timestamp": now,
    }
    if listing_id not in RATINGS:
        RATINGS[listing_id] = []
    RATINGS[listing_id].append(rating)
    listing = LISTINGS.get(listing_id)
    if listing:
        scores = [r["score"] for r in RATINGS[listing_id]]
        listing["ratingAvg"] = round(sum(scores) / len(scores), 2)
        listing["ratingCount"] = len(scores)
    return rating

async def get_ratings(listing_id: str) -> list[dict]:
    return RATINGS.get(listing_id, [])
