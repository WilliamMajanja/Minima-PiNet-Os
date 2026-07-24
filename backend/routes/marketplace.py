from fastapi import APIRouter, HTTPException

from ..marketplace import (
    cancel_order,
    complete_order,
    create_listing,
    create_order,
    create_rating,
    delete_listing,
    get_listing,
    get_order,
    get_ratings,
    list_listings,
    list_orders,
    update_listing_status,
)

router = APIRouter()

@router.get("/marketplace/listings")
async def api_list_listings(status: str = "", min_ram: int = 0, node_id: str = "", tags: str = ""):
    tag_list = tags.split(",") if tags else None
    return {"listings": await list_listings(status=status, min_ram=min_ram, node_id=node_id, tags=tag_list)}

@router.get("/marketplace/listings/{listing_id}")
async def api_get_listing(listing_id: str):
    l = await get_listing(listing_id)
    if not l:
        raise HTTPException(404, "Listing not found")
    return l

@router.post("/marketplace/listings")
async def api_create_listing(body: dict):
    try:
        return await create_listing(
            node_id=body.get("nodeId", "localhost"),
            name=body.get("name", "Unnamed"),
            description=body.get("description", ""),
            cpu_cores=body.get("cpuCores", 4),
            ram_gb=body.get("ramGb", 8),
            disk_gb=body.get("diskGb", 100),
            gpu_type=body.get("gpuType", ""),
            npu_type=body.get("npuType", "hailo-8l"),
            price_per_hour=body.get("pricePerHour", "0.01"),
            token=body.get("token", "minima"),
            location=body.get("location", ""),
            tags=body.get("tags"),
            max_lease_hours=body.get("maxLeaseHours", 720),
        )
    except RuntimeError as exc:
        raise HTTPException(400, str(exc))

@router.put("/marketplace/listings/{listing_id}")
async def api_update_listing(listing_id: str, body: dict):
    try:
        return await update_listing_status(listing_id, body.get("status", "active"))
    except KeyError:
        raise HTTPException(404, "Listing not found")

@router.delete("/marketplace/listings/{listing_id}")
async def api_delete_listing(listing_id: str):
    if not await delete_listing(listing_id):
        raise HTTPException(404, "Listing not found")
    return {"status": "deleted"}

@router.get("/marketplace/orders")
async def api_list_orders(node_id: str = ""):
    return {"orders": await list_orders(node_id)}

@router.get("/marketplace/orders/{order_id}")
async def api_get_order(order_id: str):
    o = await get_order(order_id)
    if not o:
        raise HTTPException(404, "Order not found")
    return o

@router.post("/marketplace/orders")
async def api_create_order(body: dict):
    try:
        return await create_order(
            listing_id=body.get("listingId", ""),
            buyer_node_id=body.get("buyerNodeId", ""),
            seller_node_id=body.get("sellerNodeId", ""),
            hours=body.get("hours", 1),
            token=body.get("token", "minima"),
        )
    except KeyError as exc:
        raise HTTPException(400, str(exc))

@router.post("/marketplace/orders/{order_id}/complete")
async def api_complete_order(order_id: str):
    try:
        return await complete_order(order_id)
    except KeyError:
        raise HTTPException(404, "Order not found")

@router.post("/marketplace/orders/{order_id}/cancel")
async def api_cancel_order(order_id: str):
    try:
        return await cancel_order(order_id)
    except KeyError:
        raise HTTPException(404, "Order not found")

@router.post("/marketplace/ratings")
async def api_create_rating(body: dict):
    return await create_rating(
        listing_id=body.get("listingId", ""),
        order_id=body.get("orderId", ""),
        reviewer_node_id=body.get("reviewerNodeId", ""),
        score=body.get("score", 5),
        review=body.get("review", ""),
    )

@router.get("/marketplace/ratings/{listing_id}")
async def api_get_ratings(listing_id: str):
    return {"ratings": await get_ratings(listing_id)}
