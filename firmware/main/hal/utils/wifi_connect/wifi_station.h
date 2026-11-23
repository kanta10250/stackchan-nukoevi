#pragma once

#include <cstdint>
#include <functional>
#include <string>

// BLE provisioning shares the board's WifiManager instead of owning a second
// Wi-Fi driver, station interface, or set of reconnection event handlers.
class StackChanWifiStation {
public:
    bool Start();
    void Stop();
    bool AddAuth(const std::string& ssid, const std::string& password);
    bool IsConnected();
    void Update();

    void OnConnect(std::function<void(const std::string& ssid)> callback);
    void OnConnected(std::function<void(const std::string& ssid)> callback);
    void OnConnectFailed(std::function<void(const std::string& ssid)> callback);

private:
    static constexpr int64_t connection_timeout_us_ = 60LL * 1000 * 1000;
    std::string ssid_;
    bool is_started_ = false;
    bool is_connecting_ = false;
    int64_t connection_started_us_ = 0;
    std::function<void(const std::string&)> on_connect_;
    std::function<void(const std::string&)> on_connected_;
    std::function<void(const std::string&)> on_connect_failed_;
};
