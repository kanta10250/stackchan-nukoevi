#pragma once
#include <string>
#include <functional>
#include <cassert>

class WifiManager {
public:
    static WifiManager& GetInstance()
    {
        static WifiManager instance;
        return instance;
    }

    bool IsInitialized() const { return initialized; }
    bool Initialize()
    {
        ++initializations;
        initialized = initialize_succeeds;
        return initialized;
    }
    bool IsConnected() const { return connected; }
    std::string GetSsid() const { return ssid; }
    void StopStation() { ++stops; connected = false; station_active = false; }
    void StopConfigAp()
    {
        if (config_mode_active) {
            config_mode_active = false;
            if (on_config_exit) on_config_exit();
        }
    }
    void StartStation()
    {
        assert(!config_mode_active);
        ++starts;
        if (!station_active) {
            ++station_interfaces;
            station_active = true;
        }
    }

    bool initialized = false;
    bool initialize_succeeds = true;
    bool connected = false;
    bool station_active = false;
    bool config_mode_active = false;
    std::function<void()> on_config_exit;
    std::string ssid;
    int initializations = 0;
    int starts = 0;
    int stops = 0;
    int station_interfaces = 0;
};
