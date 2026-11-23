#pragma once
#include <string>

class SsidManager {
public:
    static SsidManager& GetInstance()
    {
        static SsidManager instance;
        return instance;
    }
    void AddSsid(const std::string& ssid, const std::string& password)
    {
        saved_ssid = ssid;
        saved_password = password;
        ++writes;
    }

    std::string saved_ssid;
    std::string saved_password;
    int writes = 0;
};
