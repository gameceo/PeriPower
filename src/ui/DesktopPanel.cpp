#include "DesktopPanel.h"
#include "util/DeviceSettings.h"
#include <QCloseEvent>
#include <QLabel>
#include <QMenu>
#include <QPushButton>
#include <QSettings>
#include <QVBoxLayout>
#include <QAction>
#include <QCursor>

DesktopPanel::DesktopPanel(QWidget *parent)
    : QWidget(parent, Qt::Window | Qt::WindowStaysOnTopHint), m_content(new QLabel(this))
{
    setWindowTitle(QStringLiteral("PeriPower · 桌面电量"));
    setMinimumSize(300, 120);
    auto *layout = new QVBoxLayout(this);
    auto *select = new QPushButton(QStringLiteral("选择显示设备"), this);
    layout->addWidget(select);
    m_content->setTextFormat(Qt::PlainText);
    m_content->setWordWrap(true);
    m_content->setTextInteractionFlags(Qt::TextSelectableByMouse);
    layout->addWidget(m_content);
    connect(select, &QPushButton::clicked, this, [this] { selectDevices(); });
    QSettings settings;
    m_selected = settings.value("desktopPanel/devices").toStringList();
    restoreGeometry(settings.value("desktopPanel/geometry").toByteArray());
    render();
}

void DesktopPanel::setDevices(const QList<BatteryDevice> &devices)
{
    m_devices = devices;
    render();
}

void DesktopPanel::selectDevices()
{
    QMenu menu(this);
    auto *all = menu.addAction(QStringLiteral("全部设备"));
    all->setCheckable(true);
    all->setChecked(m_selected.isEmpty());
    connect(all, &QAction::triggered, this, [this] {
        m_selected.clear(); QSettings().setValue("desktopPanel/devices", m_selected); render();
    });
    for (const auto &device : m_devices) {
        const QString id = QString::fromStdWString(device.id);
        const QString alias = DeviceSettings::alias(id);
        auto *entry = menu.addAction(alias.isEmpty() ? QString::fromStdWString(device.name) : alias);
        entry->setCheckable(true);
        entry->setChecked(m_selected.contains(id));
        connect(entry, &QAction::triggered, this, [this, id](bool checked) {
            if (checked && !m_selected.contains(id)) m_selected.append(id);
            else if (!checked) m_selected.removeAll(id);
            QSettings().setValue("desktopPanel/devices", m_selected); render();
        });
    }
    menu.exec(QCursor::pos());
}

void DesktopPanel::render()
{
    QStringList lines;
    for (const auto &device : m_devices) {
        const QString id = QString::fromStdWString(device.id);
        if (!m_selected.isEmpty() && !m_selected.contains(id)) continue;
        const QString alias = DeviceSettings::alias(id);
        const QString name = alias.isEmpty() ? QString::fromStdWString(device.name) : alias;
        QString value;
        if (device.percentage >= 0) value = QString::number(device.percentage) + '%';
        else {
            switch (device.level) {
            case BatteryLevel::Empty: value = QStringLiteral("空"); break;
            case BatteryLevel::Low: value = QStringLiteral("低"); break;
            case BatteryLevel::Medium: value = QStringLiteral("中"); break;
            case BatteryLevel::Full: value = QStringLiteral("满"); break;
            default: value = QStringLiteral("未知"); break;
            }
        }
        if (device.leftPercent >= 0 || device.rightPercent >= 0 || device.casePercent >= 0) {
            const auto percent = [](int n) { return n < 0 ? QStringLiteral("未知") : QString::number(n) + '%'; };
            value = QStringLiteral("左 %1 / 右 %2 / 盒 %3").arg(percent(device.leftPercent), percent(device.rightPercent), percent(device.casePercent));
        }
        if (device.stale) value += QStringLiteral(" · 缓存");
        else if (!device.connected) value += QStringLiteral(" · 离线");
        else if (device.charging) value += QStringLiteral(" · 充电");
        lines.append(name + QStringLiteral("\n") + value);
    }
    m_content->setText(lines.isEmpty() ? QStringLiteral("暂无所选设备电量，等待采集…") : lines.join(QStringLiteral("\n\n")));
}

void DesktopPanel::closeEvent(QCloseEvent *event)
{
    QSettings settings;
    settings.setValue("desktopPanel/geometry", saveGeometry());
    settings.setValue("desktopPanel/visible", false);
    event->ignore(); hide();
}
