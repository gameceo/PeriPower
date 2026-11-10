#pragma once
#include "src/core/BatteryDevice.h"
#include <QWidget>
#include <QList>
#include <QStringList>
class QLabel;
class QCloseEvent;
class QMenu;
class DesktopPanel : public QWidget {
public:
    explicit DesktopPanel(QWidget *parent = nullptr);
    void setDevices(const QList<BatteryDevice> &devices);
protected:
    void closeEvent(QCloseEvent *event) override;
private:
    void render();
    void selectDevices();
    QLabel *m_content;
    QList<BatteryDevice> m_devices;
    QStringList m_selected;
};
