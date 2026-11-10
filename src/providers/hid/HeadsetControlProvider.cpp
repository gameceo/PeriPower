#include "HeadsetControlProvider.h"
#include <QCoreApplication>
#include <QFileInfo>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QProcess>

std::vector<BatteryDevice> HeadsetControlProvider::parseOutput(const QByteArray &json)
{
    std::vector<BatteryDevice> result;
    if (json.size() > 1024 * 1024) return result;
    QJsonParseError error;
    const auto document = QJsonDocument::fromJson(json, &error);
    if (error.error != QJsonParseError::NoError || !document.isObject()) return result;
    const auto root = document.object();
    if (root.value("name").toString() != QStringLiteral("HeadsetControl")) return result;
    for (const auto &entry : root.value("devices").toArray()) {
        const auto object = entry.toObject();
        if (object.value("id_vendor").toString() != QStringLiteral("0x046d") ||
            object.value("id_product").toString() != QStringLiteral("0x0af7")) continue;
        const auto battery = object.value("battery").toObject();
        const auto status = battery.value("status").toString();
        const auto value = battery.value("level");
        if (object.value("errors").toObject().contains("battery") ||
            (status != QStringLiteral("BATTERY_AVAILABLE") && status != QStringLiteral("BATTERY_CHARGING")) ||
            !value.isDouble()) continue;
        const double number = value.toDouble(-1);
        const int percentage = value.toInt(-1);
        if (percentage < 0 || percentage > 100 || number != percentage) continue;
        BatteryDevice device;
        device.id = L"headsetcontrol:046d:0af7";
        device.name = L"Logitech PRO X 2 LIGHTSPEED";
        device.type = BatteryDevice::Type::Hid;
        device.percentage = percentage;
        device.level = percentage >= 80 ? BatteryLevel::Full : percentage >= 50 ? BatteryLevel::Medium :
                       percentage >= 20 ? BatteryLevel::Low : BatteryLevel::Empty;
        device.connected = true;
        device.charging = status == QStringLiteral("BATTERY_CHARGING");
        result.push_back(device);
        break; // MVP supports one PRO X 2 receiver; no ambiguous duplicate IDs.
    }
    return result;
}

std::vector<BatteryDevice> HeadsetControlProvider::readDevices()
{
    const QString helper = QCoreApplication::applicationDirPath() + QStringLiteral("/helpers/headsetcontrol.exe");
    if (!QFileInfo::exists(helper)) return {};
    QProcess process;
    process.setProgram(helper);
    process.setArguments({QStringLiteral("-d"), QStringLiteral("046d:0af7"), QStringLiteral("-b"), QStringLiteral("-o"), QStringLiteral("json")});
    process.start();
    if (!process.waitForStarted(1500)) return {};
    if (!process.waitForFinished(5000)) {
        process.kill(); process.waitForFinished(1000); return {};
    }
    if (process.exitStatus() != QProcess::NormalExit || process.exitCode() != 0) return {};
    return parseOutput(process.readAllStandardOutput());
}
