#include "wifi_station.h"

#include <esp_log.h>
#include <esp_timer.h>
#include <ssid_manager.h>
#include <wifi_manager.h>
#include <utility>

static constexpr const char* TAG = "StackChanWifiStation";

bool StackChanWifiStation::Start()
{
    if (is_started_) {
        return true;
    }

    auto& wifi = WifiManager::GetInstance();
    if (!wifi.IsInitialized() && !wifi.Initialize()) {
        ESP_LOGE(TAG, "Cannot initialize shared WiFi manager");
        return false;
    }

    is_started_ = true;
    ESP_LOGI(TAG, "Using shared WiFi manager");
    return true;
}

void StackChanWifiStation::Stop()
{
    // Closing provisioning must leave the board's network running.
    is_connecting_ = false;
    is_started_ = false;
}

bool StackChanWifiStation::AddAuth(const std::string& ssid, const std::string& password)
{
    // The upstream station copies SSIDs with strcpy into a 32-byte array.
    // Reject the boundary value here until that upstream path supports it safely.
    if (!is_started_ || is_connecting_ || ssid.empty() || ssid.size() >= 32 || password.size() > 63 ||
        ssid.find('\0') != std::string::npos || password.find('\0') != std::string::npos) {
        ESP_LOGW(TAG, "Cannot apply WiFi credentials: inactive, busy, or invalid input");
        return false;
    }

    auto& wifi = WifiManager::GetInstance();
    wifi.StopStation();
    SsidManager::GetInstance().AddSsid(ssid, password);

    ssid_ = ssid;
    is_connecting_ = true;
    connection_started_us_ = esp_timer_get_time();
    if (on_connect_) {
        on_connect_(ssid_);
    }

    // ConfigModeExit can synchronously make WifiBoard start the station. Exit
    // the AP first so StartStation does not re-enter its own AP transition.
    wifi.StopConfigAp();
    wifi.StartStation();
    return true;
}

bool StackChanWifiStation::IsConnected()
{
    return is_started_ && WifiManager::GetInstance().IsConnected();
}

void StackChanWifiStation::Update()
{
    if (!is_connecting_) {
        return;
    }

    auto& wifi = WifiManager::GetInstance();
    if (wifi.IsConnected() && wifi.GetSsid() == ssid_) {
        is_connecting_ = false;
        ESP_LOGI(TAG, "Connected to requested WiFi network");
        if (on_connected_) {
            on_connected_(ssid_);
        }
    } else if (esp_timer_get_time() - connection_started_us_ >= connection_timeout_us_) {
        is_connecting_ = false;
        ESP_LOGW(TAG, "Timed out connecting to requested WiFi network");
        if (on_connect_failed_) {
            on_connect_failed_(ssid_);
        }
    }
}

void StackChanWifiStation::OnConnect(std::function<void(const std::string&)> callback)
{
    on_connect_ = std::move(callback);
}

void StackChanWifiStation::OnConnected(std::function<void(const std::string&)> callback)
{
    on_connected_ = std::move(callback);
}

void StackChanWifiStation::OnConnectFailed(std::function<void(const std::string&)> callback)
{
    on_connect_failed_ = std::move(callback);
}
