// Windows のリリースビルドで追加のコンソールウィンドウが出ないようにする。消さないこと。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    kodou_lib::run()
}
