#include "wifi_station.h"
#include "provisioning_window.h"
#include <esp_timer.h>
#include <ssid_manager.h>
#include <wifi_manager.h>
#include <cassert>
#include <iostream>

static void reset()
{
    WifiManager::GetInstance() = WifiManager{};
    SsidManager::GetInstance() = SsidManager{};
    test_time_us = 0;
}

static void opening_setup_preserves_existing_connection()
{
    reset();
    auto& wifi = WifiManager::GetInstance();
    wifi.initialized = true;
    wifi.connected = true;
    wifi.ssid = "existing-network";
    {
        StackChanWifiStation first;
        StackChanWifiStation second;
        assert(first.Start());
        assert(first.Start());
        assert(second.Start());
        first.Update();
        assert(first.IsConnected());
        first.Stop();
        assert(second.IsConnected());
    }
    assert(wifi.connected);
    assert(wifi.initializations == 0);
    assert(wifi.starts == 0 && wifi.stops == 0);
}

static void initialization_failure_can_be_retried()
{
    reset();
    auto& wifi = WifiManager::GetInstance();
    wifi.initialize_succeeds = false;
    StackChanWifiStation station;
    assert(!station.Start());
    assert(!station.AddAuth("network", "password"));
    wifi.initialize_succeeds = true;
    assert(station.Start());
    assert(station.Start());
    assert(wifi.initializations == 2);
}

static void invalid_credentials_do_not_change_network_or_storage()
{
    reset();
    auto& wifi = WifiManager::GetInstance();
    wifi.initialized = true;
    wifi.connected = true;
    StackChanWifiStation station;
    assert(!station.AddAuth("network", "password"));
    assert(station.Start());
    assert(!station.AddAuth("", "password"));
    assert(!station.AddAuth(std::string(32, 's'), "password"));
    assert(!station.AddAuth("network", std::string(64, 'p')));
    assert(!station.AddAuth(std::string("a\0b", 3), "password"));
    assert(!station.AddAuth("network", std::string("a\0b", 3)));
    assert(wifi.connected);
    assert(wifi.starts == 0 && wifi.stops == 0);
    assert(SsidManager::GetInstance().writes == 0);
}

static void successful_connection_notifies_once_and_preserves_board_wifi()
{
    reset();
    auto& wifi = WifiManager::GetInstance();
    StackChanWifiStation station;
    int connecting = 0, connected = 0, failed = 0;
    const std::string target(31, 's');
    station.OnConnect([&](const std::string& ssid) { assert(ssid == target); ++connecting; });
    station.OnConnected([&](const std::string& ssid) { assert(ssid == target); ++connected; });
    station.OnConnectFailed([&](const std::string&) { ++failed; });
    assert(station.Start());
    assert(station.AddAuth(target, std::string(63, 'p')));
    assert(!station.AddAuth("other-network", "password"));
    assert(SsidManager::GetInstance().saved_ssid == target);
    assert(SsidManager::GetInstance().saved_password == std::string(63, 'p'));
    station.Update();
    assert(connecting == 1 && connected == 0 && failed == 0);
    wifi.connected = true;
    wifi.ssid = target;
    station.Update();
    station.Update();
    assert(connected == 1 && failed == 0);
    station.Stop();
    assert(wifi.connected);
    assert(wifi.starts == 1 && wifi.stops == 1);
}

static void fallback_network_does_not_report_requested_network_as_success()
{
    reset();
    auto& wifi = WifiManager::GetInstance();
    StackChanWifiStation station;
    int connected = 0, failed = 0;
    station.OnConnected([&](const std::string&) { ++connected; });
    station.OnConnectFailed([&](const std::string&) { ++failed; });
    assert(station.Start());
    assert(station.AddAuth("unreachable-network", "password"));
    wifi.connected = true;
    wifi.ssid = "previous-network";
    test_time_us = 59'999'999;
    station.Update();
    assert(connected == 0 && failed == 0);
    test_time_us = 60'000'000;
    station.Update();
    station.Update();
    assert(connected == 0 && failed == 1);
    assert(wifi.connected);
    assert(station.AddAuth("open-network", ""));
    station.Stop();
    test_time_us += 60'000'000;
    station.Update();
    assert(failed == 1);
}

static void provisioning_from_hotspot_creates_one_station_interface()
{
    reset();
    auto& wifi = WifiManager::GetInstance();
    wifi.initialized = true;
    wifi.config_mode_active = true;
    wifi.on_config_exit = [&]() {
        assert(SsidManager::GetInstance().saved_ssid == "new-network");
        wifi.StartStation();
    };
    StackChanWifiStation station;
    assert(station.Start());
    assert(station.AddAuth("new-network", "password"));
    assert(!wifi.config_mode_active);
    assert(wifi.station_interfaces == 1);
}

int main()
{
    ProvisioningWindow window;
    assert(!window.Allows(0));
    window.Open(100);
    assert(window.Allows(100));
    assert(window.Allows(300099));
    assert(!window.Allows(300100));
    window.Open(UINT32_MAX - 100);
    assert(window.Allows(100));
    window.Close();
    assert(!window.Allows(100));
    opening_setup_preserves_existing_connection();
    initialization_failure_can_be_retried();
    invalid_credentials_do_not_change_network_or_storage();
    successful_connection_notifies_once_and_preserves_board_wifi();
    fallback_network_does_not_report_requested_network_as_success();
    provisioning_from_hotspot_creates_one_station_interface();
    std::cout << "Wi-Fi provisioning: 6 tests passed\n";
}
