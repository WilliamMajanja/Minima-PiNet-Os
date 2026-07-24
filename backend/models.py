"""PiNet-OS Pydantic Models — ported from types.ts and types/ directory."""
from __future__ import annotations
from decimal import Decimal
from typing import Optional, Literal, Any
from pydantic import BaseModel, Field
from enum import Enum


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


class MinimaState(BaseModel):
    balance: Decimal = Decimal("0")
    block_height: int = Field(alias="blockHeight", default=0)
    status: str = "Offline"
    peers: int = 0
    transactions: list[dict[str, Any]] = Field(default_factory=list)
    version: str = ""
    uptime: str = ""
    tip: str = ""

    class Config:
        populate_by_name = True


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
    cpip_identity: Optional[str] = None
    cpip_public_key: Optional[str] = None
    cpip_attestation: Optional[str] = None


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


class PiNetState(BaseModel):
    minima: MinimaState = MinimaState()
    cluster: list[ClusterNode] = Field(default_factory=list)
    settings: Settings = Settings()
    pinet2: PiNet2State = PiNet2State()


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
    AUTH_CHALLENGE = "AUTH_CHALLENGE"
    AUTH_RESPONSE = "AUTH_RESPONSE"


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
    signature: Optional[str] = None


class ClusterExecRequest(BaseModel):
    target_node_id: str = Field(alias="targetNodeId")
    command: str
    args: list[str] = Field(default_factory=list)
    signature: Optional[str] = None

    class Config:
        populate_by_name = True


class LocalExecRequest(BaseModel):
    workload_id: Optional[str] = Field(alias="workloadId", default=None)
    command: str
    args: list[str] = Field(default_factory=list)
    timeout: int = 30000

    class Config:
        populate_by_name = True


# ─── Custom User Sensors (Pi Zero 2 W optimized) ──────────────────────────────

class SensorBus(str, Enum):
    I2C = "i2c"
    GPIO = "gpio"
    SPI = "spi"
    ONE_WIRE = "1-wire"
    ADC = "adc"
    UART = "uart"


class SensorKind(str, Enum):
    TEMPERATURE = "temperature"
    HUMIDITY = "humidity"
    PRESSURE = "pressure"
    LIGHT = "light"
    SOIL_MOISTURE = "soil_moisture"
    AIR_QUALITY = "air_quality"
    PROXIMITY = "proximity"
    CUSTOM = "custom"


class CustomSensorDef(BaseModel):
    """User-defined sensor attached to a Pi node (incl. Pi Zero 2 W).

    Pi Zero 2 W (BCM2837B0) shares the Pi 3 SoC but with only 512 MB RAM and
    a single-core-turbo clock; custom sensors are tuned with conservative
    polling intervals and limited simultaneous sensor counts.
    """
    id: str
    name: str
    kind: SensorKind = SensorKind.CUSTOM
    bus: SensorBus = SensorBus.I2C
    address: Optional[str] = None
    pin: Optional[int] = None
    spi_channel: Optional[int] = Field(alias="spiChannel", default=None)
    poll_interval: int = Field(alias="pollInterval", default=15)
    unit: str = ""
    min_value: Optional[float] = Field(alias="minValue", default=None)
    max_value: Optional[float] = Field(alias="maxValue", default=None)
    enabled: bool = True
    calibration_offset: float = Field(alias="calibrationOffset", default=0.0)
    calibration_scale: float = Field(alias="calibrationScale", default=1.0)
    node_id: Optional[str] = Field(alias="nodeId", default=None)

    class Config:
        populate_by_name = True


class SensorReading(BaseModel):
    sensor_id: str = Field(alias="sensorId")
    value: float
    unit: str = ""
    timestamp: str = ""
    raw: Optional[float] = None
    error: Optional[str] = None

    class Config:
        populate_by_name = True


class PlatformSensorCaps(BaseModel):
    """Per-platform sensor capability limits.

    Pi Zero 2 W (`zero2w`) is the primary target for custom user sensors:
    limited RAM (512 MB), single-core turbo, shared I2C bus 1, and a
    conservative max-sensor count to avoid I2C address collisions.
    """
    platform: str
    max_sensors: int = Field(alias="maxSensors", default=4)
    min_poll_interval: int = Field(alias="minPollInterval", default=15)
    i2c_bus: int = Field(alias="i2cBus", default=1)
    supports_spi: bool = Field(alias="supportsSpi", default=True)
    supports_gpio: bool = Field(alias="supportsGpio", default=True)
    supports_one_wire: bool = Field(alias="supportsOneWire", default=True)
    supports_adc: bool = Field(alias="supportsAdc", default=True)
    label: str = ""

    class Config:
        populate_by_name = True


# ─── v1.3.0: On-Device LLM Gateway ───────────────────────────────────────────

class LLMModel(BaseModel):
    """A registered local LLM model in the gateway."""
    name: str
    size: str = ""
    quantization: str = ""
    family: str = ""
    context_length: int = Field(alias="contextLength", default=4096)
    installed: bool = False
    size_bytes: int = Field(alias="sizeBytes", default=0)
    hailo_accelerated: bool = Field(alias="hailoAccelerated", default=False)

    class Config:
        populate_by_name = True


class LLMChatRequest(BaseModel):
    model: str = ""
    prompt: str
    system: str = ""
    temperature: float = 0.7
    max_tokens: int = Field(alias="maxTokens", default=512)
    stream: bool = False
    context: str = ""

    class Config:
        populate_by_name = True


class LLMChatResponse(BaseModel):
    model: str
    text: str
    provider: str = "local"
    tokens_eval: int = Field(alias="tokensEval", default=0)
    tokens_prompt: int = Field(alias="tokensPrompt", default=0)
    duration_ms: int = Field(alias="durationMs", default=0)
    hailo_accelerated: bool = Field(alias="hailoAccelerated", default=False)

    class Config:
        populate_by_name = True


# ─── v1.3.0: Multi-Tenant LXC Quotas ─────────────────────────────────────────

class LXCQuota(BaseModel):
    """Resource quota for an LXC tenant container."""
    tenant_id: str = Field(alias="tenantId")
    container_name: str = Field(alias="containerName", default="")
    cpu_limit: int = Field(alias="cpuLimit", default=50)
    ram_limit_mb: int = Field(alias="ramLimitMb", default=512)
    disk_limit_gb: int = Field(alias="diskLimitGb", default=10)
    io_iops: int = Field(alias="ioIops", default=1000)
    network_mbps: int = Field(alias="networkMbps", default=100)
    processes_max: int = Field(alias="processesMax", default=512)
    enabled: bool = True
    created_at: str = Field(alias="createdAt", default="")

    class Config:
        populate_by_name = True


class LXCQuotaUsage(BaseModel):
    """Current resource usage for an LXC tenant."""
    tenant_id: str = Field(alias="tenantId")
    cpu_percent: float = Field(alias="cpuPercent", default=0.0)
    ram_used_mb: float = Field(alias="ramUsedMb", default=0.0)
    disk_used_gb: float = Field(alias="diskUsedGb", default=0.0)
    io_read_iops: int = Field(alias="ioReadIops", default=0)
    io_write_iops: int = Field(alias="ioWriteIops", default=0)
    processes: int = 0
    running: bool = False

    class Config:
        populate_by_name = True


# ─── v1.3.0: Hardware Key-Wrap (TPM 2.0) ─────────────────────────────────────

class TPMSealedKey(BaseModel):
    """A TPM 2.0-sealed CPIP master key."""
    key_id: str = Field(alias="keyId")
    sealed_path: str = Field(alias="sealedPath", default="")
    pcr_bank: str = Field(alias="pcrBank", default="sha256")
    pcr_selection: list[int] = Field(alias="pcrSelection", default_factory=list)
    sealed: bool = False
    unsealed_at_boot: bool = Field(alias="unsealedAtBoot", default=False)
    tpm_available: bool = Field(alias="tpmAvailable", default=False)

    class Config:
        populate_by_name = True


class TPMAttestation(BaseModel):
    """TPM 2.0 PCR attestation record."""
    pcr_bank: str = Field(alias="pcrBank", default="sha256")
    pcr_values: dict[str, str] = Field(alias="pcrValues", default_factory=dict)
    tpm_version: str = Field(alias="tpmVersion", default="")
    verified: bool = False
    timestamp: str = ""

    class Config:
        populate_by_name = True


# ─── v1.3.0: CPIP PQ-TLS ────────────────────────────────────────────────────

class PQTLSStatus(BaseModel):
    """Post-quantum TLS configuration status."""
    enabled: bool = False
    kem_algorithm: str = Field(alias="kemAlgorithm", default="kyber768")
    hybrid_mode: bool = Field(alias="hybridMode", default=True)
    classical_curve: str = Field(alias="classicalCurve", default="ecdh-p256")
    certificate_available: bool = Field(alias="certificateAvailable", default=False)
    pq_handshake_count: int = Field(alias="pqHandshakeCount", default=0)

    class Config:
        populate_by_name = True


# ─── v2.0.0: Formal Attestation ──────────────────────────────────────────────

class AttestationRecord(BaseModel):
    """A formal remote attestation record anchored to the Minima ledger."""
    attestation_id: str = Field(alias="attestationId")
    node_id: str = Field(alias="nodeId")
    pcr_bank: str = Field(alias="pcrBank", default="sha256")
    pcr_values: dict[str, str] = Field(alias="pcrValues", default_factory=dict)
    boot_hash: str = Field(alias="bootHash", default="")
    config_hash: str = Field(alias="configHash", default="")
    timestamp: str = ""
    verified: bool = False
    ledger_txid: str = Field(alias="ledgerTxid", default="")

    class Config:
        populate_by_name = True


class AttestationVerifyResult(BaseModel):
    """Result of verifying an attestation record."""
    attestation_id: str = Field(alias="attestationId")
    valid: bool = False
    pcr_mismatch: list[str] = Field(alias="pcrMismatch", default_factory=list)
    boot_hash_mismatch: bool = Field(alias="bootHashMismatch", default=False)
    config_hash_mismatch: bool = Field(alias="configHashMismatch", default=False)
    timestamp: str = ""

    class Config:
        populate_by_name = True


# ─── v3.0.0: Confidential Computing Enclaves ────────────────────────────────

class EnclaveStatus(str, Enum):
    CREATING = "creating"
    RUNNING = "running"
    STOPPED = "stopped"
    TERMINATED = "terminated"
    ATTESTED = "attested"

class EnclaveDef(BaseModel):
    """A confidential computing enclave instantiation."""
    enclave_id: str = Field(alias="enclaveId")
    name: str
    tee_type: str = Field(alias="teeType", default="cca")
    status: EnclaveStatus = EnclaveStatus.CREATING
    memory_mb: int = Field(alias="memoryMb", default=1024)
    cpu_count: int = Field(alias="cpuCount", default=2)
    measurement: str = ""
    runtime: str = "linux"
    image_ref: str = Field(alias="imageRef", default="")
    node_id: str = Field(alias="nodeId", default="localhost")
    attestation_token: str = Field(alias="attestationToken", default="")
    created_at: str = Field(alias="createdAt", default="")

    class Config:
        populate_by_name = True

class EnclaveMeasurement(BaseModel):
    """Cryptographic measurement (hash) of an enclave's runtime."""
    enclave_id: str = Field(alias="enclaveId")
    pcr_values: dict[str, str] = Field(alias="pcrValues", default_factory=dict)
    runtime_hash: str = Field(alias="runtimeHash", default="")
    config_hash: str = Field(alias="configHash", default="")
    signing_key_fingerprint: str = Field(alias="signingKeyFingerprint", default="")
    timestamp: str = ""

    class Config:
        populate_by_name = True

class EnclaveAttestation(BaseModel):
    """Attestation report for a confidential computing enclave."""
    enclave_id: str = Field(alias="enclaveId")
    attested: bool = False
    measurement: str = ""
    verification_result: str = Field(alias="verificationResult", default="")
    ledger_txid: str = Field(alias="ledgerTxid", default="")
    timestamp: str = ""

    class Config:
        populate_by_name = True


# ─── v3.0.0: Verifiable Compute Proofs (zkVM) ─────────────────────────────

class ZKProof(BaseModel):
    """A zero-knowledge proof generated or verified by the zkVM prover."""
    proof_id: str = Field(alias="proofId")
    program_hash: str = Field(alias="programHash", default="")
    public_inputs: dict[str, str] = Field(alias="publicInputs", default_factory=dict)
    proof_bytes: str = Field(alias="proofBytes", default="")
    verified: bool = False
    verification_time_ms: int = Field(alias="verificationTimeMs", default=0)
    prover_backend: str = Field(alias="proverBackend", default="risc0")
    proof_size_bytes: int = Field(alias="proofSizeBytes", default=0)
    ledger_txid: str = Field(alias="ledgerTxid", default="")
    created_at: str = Field(alias="createdAt", default="")

    class Config:
        populate_by_name = True

class ZKProofRequest(BaseModel):
    """Request to generate a zero-knowledge proof."""
    program_source: str = Field(alias="programSource")
    program_args: list[str] = Field(alias="programArgs", default_factory=list)
    public_inputs: dict[str, str] = Field(alias="publicInputs", default_factory=dict)
    prover_backend: str = Field(alias="proverBackend", default="risc0")
    timeout: int = 300

    class Config:
        populate_by_name = True

class ZKVerifyRequest(BaseModel):
    """Request to verify a zero-knowledge proof."""
    proof_id: str = Field(alias="proofId")
    program_hash: str = Field(alias="programHash")
    public_inputs: dict[str, str] = Field(alias="publicInputs", default_factory=dict)
    proof_bytes: str = Field(alias="proofBytes")

    class Config:
        populate_by_name = True


# ─── v3.0.0: Decentralized Compute Marketplace ─────────────────────────────

class ListingStatus(str, Enum):
    ACTIVE = "active"
    PENDING = "pending"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class ComputeListing(BaseModel):
    """A compute resource listing on the decentralized marketplace."""
    listing_id: str = Field(alias="listingId")
    node_id: str = Field(alias="nodeId")
    name: str
    description: str = ""
    cpu_cores: int = Field(alias="cpuCores", default=4)
    ram_gb: int = Field(alias="ramGb", default=8)
    disk_gb: int = Field(alias="diskGb", default=100)
    gpu_type: str = Field(alias="gpuType", default="")
    npu_type: str = Field(alias="npuType", default="hailo-8l")
    price_per_hour: str = Field(alias="pricePerHour", default="0.01")
    token: str = "minima"
    location: str = ""
    status: ListingStatus = ListingStatus.ACTIVE
    uptime_pct: float = Field(alias="uptimePct", default=99.0)
    rating_avg: float = Field(alias="ratingAvg", default=0.0)
    rating_count: int = Field(alias="ratingCount", default=0)
    tags: list[str] = Field(default_factory=list)
    max_lease_hours: int = Field(alias="maxLeaseHours", default=720)
    created_at: str = Field(alias="createdAt", default="")

    class Config:
        populate_by_name = True

class ComputeOrder(BaseModel):
    """An order/lease for compute resources."""
    order_id: str = Field(alias="orderId")
    listing_id: str = Field(alias="listingId")
    buyer_node_id: str = Field(alias="buyerNodeId")
    seller_node_id: str = Field(alias="sellerNodeId")
    hours: int = 1
    total_price: str = Field(alias="totalPrice", default="0.01")
    token: str = "minima"
    status: ListingStatus = ListingStatus.PENDING
    escrow_txid: str = Field(alias="escrowTxid", default="")
    attestation_ref: str = Field(alias="attestationRef", default="")
    created_at: str = Field(alias="createdAt", default="")
    completed_at: str = Field(alias="completedAt", default="")

    class Config:
        populate_by_name = True

class MarketplaceRating(BaseModel):
    """Rating and review for a marketplace listing."""
    listing_id: str = Field(alias="listingId")
    order_id: str = Field(alias="orderId")
    reviewer_node_id: str = Field(alias="reviewerNodeId")
    score: int = 5
    review: str = ""
    timestamp: str = ""

    class Config:
        populate_by_name = True