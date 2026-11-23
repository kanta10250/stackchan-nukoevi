#!/bin/sh
set -eu

repo_root=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
test_dir="$repo_root/firmware/tests/wifi_provisioning"
build_dir=$(mktemp -d "${TMPDIR:-/tmp}/nukoevi-wifi-test.XXXXXX")
trap 'rm -rf "$build_dir"' EXIT HUP INT TERM

"${CXX:-c++}" -std=c++17 -Wall -Wextra -Werror -fsanitize=address,undefined \
    -I"$test_dir/fakes" -I"$repo_root/firmware/main/hal/utils/wifi_connect" \
    "$test_dir/wifi_provisioning_test.cpp" \
    "$repo_root/firmware/main/hal/utils/wifi_connect/wifi_station.cc" \
    -o "$build_dir/wifi_provisioning_test"
"$build_dir/wifi_provisioning_test"
