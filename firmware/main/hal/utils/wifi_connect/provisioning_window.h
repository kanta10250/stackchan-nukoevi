#pragma once
#include <atomic>
#include <cstdint>

// A physical visit to setup grants a short provisioning window. The BLE
// server can stay initialized without permitting indefinite Wi-Fi changes.
class ProvisioningWindow {
public:
    void Open(uint32_t now_ms) { started_ms_.store(now_ms); open_.store(true); }
    void Close() { open_.store(false); }
    bool Allows(uint32_t now_ms) const {
        return open_.load() && static_cast<uint32_t>(now_ms - started_ms_.load()) < 300000;
    }
private:
    std::atomic<bool> open_{false};
    std::atomic<uint32_t> started_ms_{0};
};
