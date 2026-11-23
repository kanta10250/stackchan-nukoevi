/*
 * SPDX-FileCopyrightText: 2026 M5Stack Technology CO LTD
 *
 * SPDX-License-Identifier: MIT
 *
 * Modified for standalone CoreS3 without servos.
 */

#include "hal.h"

#include <stackchan/stackchan.h>
#include <smooth_ui_toolkit.hpp>
#include <mooncake_log.h>

#include <memory>
#include <utility>

using namespace stackchan::motion;

// Physical motor communication is disabled.
class VirtualServo final : public Servo {
public:
    explicit VirtualServo(uitk::Vector2i limits) {
        set_angle_limit(limits);
    }

protected:
    void set_angle_impl(int angle) override {
        (void)angle;
    }
};

void Hal::servo_init()
{
    mclog::tagInfo("HAL-Servo", "virtual servo mode");

    auto yaw = std::make_unique<VirtualServo>(
        uitk::Vector2i(-1280, 1280)
    );

    auto pitch = std::make_unique<VirtualServo>(
        uitk::Vector2i(0, 900)
    );

    auto motion = std::make_unique<Motion>(
        std::move(yaw),
        std::move(pitch)
    );

    motion->init();

    GetStackChan().attachMotion(std::move(motion));
}
