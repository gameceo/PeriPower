#include <QtTest>
#include <QTemporaryDir>
#include <QSettings>
#include "src/rpc/DeviceJson.h"
#include "src/rpc/JsonRpc.h"
#include "util/DeviceSettings.h"
#include "src/providers/hid/HeadsetControlProvider.h"
class RpcModelTest : public QObject {
    Q_OBJECT
private slots:
    void headsetBatteryValidation() {
        const auto wrap = [](const QByteArray &battery) {
            return QByteArray(R"({"name":"HeadsetControl","devices":[{"id_vendor":"0x046d","id_product":"0x0af7","battery":)") + battery + QByteArray("}]}");
        };
        auto readings = HeadsetControlProvider::parseOutput(wrap(R"({"status":"BATTERY_AVAILABLE","level":32})"));
        QCOMPARE(readings.size(), size_t(1));
        QCOMPARE(readings.front().percentage, 32);
        QVERIFY(HeadsetControlProvider::parseOutput(wrap(R"({"status":"BATTERY_UNAVAILABLE","level":-1})")).empty());
        QVERIFY(HeadsetControlProvider::parseOutput(wrap(R"({"status":"BATTERY_AVAILABLE","level":101})")).empty());
        QVERIFY(HeadsetControlProvider::parseOutput("bad-json").empty());
    }
    void unknownAndZero() {
        BatteryDevice device;
        QVERIFY(DeviceJson::toJson(device).value("percentage").isNull());
        device.percentage = 0;
        QCOMPARE(DeviceJson::toJson(device).value("percentage").toInt(), 0);
    }
    void aliasChangesSignature() {
        QTemporaryDir settings;
        QVERIFY(settings.isValid());
        QSettings::setDefaultFormat(QSettings::IniFormat);
        QSettings::setPath(QSettings::IniFormat, QSettings::UserScope, settings.path());
        QCoreApplication::setOrganizationName("PeriPowerTests");
        QCoreApplication::setApplicationName("RpcModel");
        BatteryDevice device; device.id = L"test-mouse";
        const auto before = DeviceJson::signature(device);
        DeviceSettings::setAlias("test-mouse", "Mouse alias");
        QVERIFY(before != DeviceJson::signature(device));
        QCOMPARE(DeviceJson::toJson(device).value("displayName").toString(), QString("Mouse alias"));
        DeviceSettings::setAlias("test-mouse", "");
    }
    void invalidRequest() {
        QVERIFY(!JsonRpc::parseRequest({{"jsonrpc", "1.0"}, {"method", "devices.list"}}).valid);
        QVERIFY(JsonRpc::parseRequest({{"jsonrpc", "2.0"}, {"method", "devices.list"}, {"id", 1}}).valid);
    }
};
QTEST_GUILESS_MAIN(RpcModelTest)
#include "RpcModelTest.moc"
