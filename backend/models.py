"""PiNet-OS Pydantic Models — ported from types.ts and types/ directory."""
from __future__ import annotations
from typing import Optional, Literal, Any
from pydantic import BaseModel, Field
from enum import Enum

# --- App IDs ---
BuiltinAppId = Literal[
    "minima-node", "system-monitor", "terminal", "wallet", "ai-assistant",
    "maxima-messenger", "cluster-manager", "depai-executor", "settings",
    "setup-wizard", "imager-utility", "file-explorer", "visual-studio",
    "dapp-store", "process-manager", "user-manager", "network-manager",
    "security-center", "log-viewer", "device-manager", "power-manager",
]

class OSMode(str, Enum):
    PINET = "pinet"
    RASPBIAN = "raspbian"
    UBUNTU = "ubuntu"
    DEBIAN = "debian"

class HatType(str, Enum):
    AI_NPU = "AI_NPU"
    SENSE = "SENSE"
    SSD_NVME = "SSD_NVME"
    NONE = "NONE"

class NodeStatus(str, Enum):
    SYNCED = "Synced"
    SYNCING = "Syncing"
    OFFLINE = "Offline"

# --- Core Models ---
class WindowState(BaseModel):
    id: str
    title: str
    is_open: bool = True
    is_minimized: bool = False
    is_maximized: bool = False
    z_index: int = 0
    x: int = 80
    y: int = 60
    width: int = 900
    height: int = 560

class NodeStats(BaseModel):
    block_height: int = Field(alias="blockHeight", default=0)
    peers: int = 0
    status: str = "Offline"
    uptime: str = "0s"
    version: str = ""

    class Config:
        populate_by_name = True

class SystemStats(BaseModel):
    cpu: float = 0
    ram: float = 0
    temp: float = 0
    disk: float = 0
    uptime: Optional[float] = None

class ClusterNodeMetrics(BaseModel):
    cpu: float = 0
    ram: float = 0
    temp: float = 0
    iops: float = 0

class ClusterNode(BaseModel):
    id: str
    name: str
    ip: str
    hat: str = "NONE"
    status: str = "online"
    metrics: ClusterNodeMetrics = ClusterNodeMetrics()

class HypervisorSwitchResult(BaseModel):
    success: bool
    target_os: str = Field(alias="targetOS")
    node_id: str = Field(alias="nodeId", default="localhost")
    transport: str = "local-systemd"
    strategy: str = "systemd"
    action: str = "restart"
    unit: str = ""
    requires_reboot: bool = Field(alias="requiresReboot", default=False)
    reboot_scheduled: bool = Field(alias="rebootScheduled", default=False)
    boot_mount: Optional[str] = Field(alias="bootMount", default=None)
    profile_label: Optional[str] = Field(alias="profileLabel", default=None)
    fallback_reason: Optional[str] = Field(alias="fallbackReason", default=None)
    stdout: str = ""
    stderr: str = ""

    class Config:
        populate_by_name = True

class Settings(BaseModel):
    wallpaper: str = "carbon"
    node_alias: str = Field(alias="nodeAlias", default="Pi-Alpha-Node")
    tor_enabled: bool = Field(alias="torEnabled", default=False)

    class Config:
        populate_by_name = True

class PiNet2State(BaseModel):
    lxc_status: str = Field(alias="lxcStatus", default="uninitialized")
    resource_priority: str = Field(alias="resourcePriority", default="host")
    ai_acceleration: str = Field(alias="aiAcceleration", default="detecting")
    health_status: str = Field(alias="healthStatus", default="unknown")
    last_health_check: Optional[str] = Field(alias="lastHealthCheck", default=None)
    system_hash: Optional[str] = Field(alias="systemHash", default=None)
    container_name: str = Field(alias="containerName", default="pinet-enterprise-env")
    cpuset: str = "2-3"
    network_type: str = Field(alias="networkType", default="wireguard-veth")
    build_status: str = Field(alias="buildStatus", default="idle")
    last_build: Optional[str] = Field(alias="lastBuild", default=None)
    build_log: list[str] = Field(alias="buildLog", default_factory=list)

    class Config:
        populate_by_name = True

class MinimaState(BaseModel):
    balance: float = 0
    block_height: int = Field(alias="blockHeight", default=0)
    status: str = "Offline"
    peers: int = 0
    transactions: list[dict[str, Any]] = Field(default_factory=list)

    class Config:
        populate_by_name = True

class PiNetState(BaseModel):
    minima: MinimaState = MinimaState()
    cluster: list[ClusterNode] = Field(default_factory=lambda: [
        ClusterNode(id="n1", name="Pi-Alpha", ip="192.168.1.10", hat="SSD_NVME", status="online"),
        ClusterNode(id="n2", name="Pi-Beta", ip="192.168.1.11", hat="SSD_NVME", status="online"),
        ClusterNode(id="n3", name="Pi-Sigma", ip="192.168.1.12", hat="AI_NPU", status="online"),
    ])
    settings: Settings = Settings()
    pinet2: PiNet2State = PiNet2State()

# --- DApp Models ---
class DAppKind(str, Enum):
    TYPESCRIPT = "typescript"
    PYTHON_DASHBOARD = "python-dashboard"
    MINIDAPP = "minidapp"

class DAppManifest(BaseModel):
    id: str
    name: str
    description: str = ""
    version: str = "1.0.0"
    author: str = "Unknown"
    kind: str = "typescript"
    icon: Optional[str] = None
    color: Optional[str] = None
    entry_point: str = Field(alias="entryPoint", default="index.html")
    permissions: list[str] = Field(default_factory=list)
    homepage: Optional[str] = None
    min_pinet_version: Optional[str] = Field(alias="minPinetVersion", default=None)

    class Config:
        populate_by_name = True

class DAppRecord(BaseModel):
    manifest: DAppManifest
    install_path: str = Field(alias="installPath")
    installed_at: str = Field(alias="installedAt")
    updated_at: str = Field(alias="updatedAt")
    status: str = "installed"

    class Config:
        populate_by_name = True

# --- Cluster Protocol Models ---
class ClusterMessageType(str, Enum):
    JOIN_REQUEST = "JOIN_REQUEST"
    JOIN_ACCEPT = "JOIN_ACCEPT"
    HEARTBEAT = "HEARTBEAT"
    STATE_UPDATE = "STATE_UPDATE"
    EXEC_REQUEST = "EXEC_REQUEST"
    EXEC_RESULT = "EXEC_RESULT"
    SNAPSHOT = "SNAPSHOT"
    METRICS = "METRICS"
    DEREGISTER = "DEREGISTER"

class FileItem(BaseModel):
    name: str
    type: str
    size: int
    modified: float
    permissions: str = "rw-r--r--"

class CommandRequest(BaseModel):
    command: str

class MaximaSendRequest(BaseModel):
    to: str
    application: str
    data: Any

class ClusterExecRequest(BaseModel):
    target_node_id: str = Field(alias="targetNodeId")
    command: str
    args: list[str] = Field(default_factory=list)

    class Config:
        populate_by_name = True

class LocalExecRequest(BaseModel):
    workload_id: Optional[str] = Field(alias="workloadId", default=None)
    command: str
    args: list[str] = Field(default_factory=list)
    timeout: int = 30000

    class Config:
        populate_by_name = True
