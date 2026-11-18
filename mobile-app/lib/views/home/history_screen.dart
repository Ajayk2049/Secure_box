import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/log.model.dart';
import '../../view_models/home_view_model.dart';
import '../widgets/glass_theme.dart';
import '../widgets/parcel_history_tile.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final deviceId = ModalRoute.of(context)?.settings.arguments as String?;
      if (deviceId != null) {
        context.read<HomeViewModel>().fetchDeviceLogs(deviceId);
      } else {
        final home = context.read<HomeViewModel>();
        if (home.devices.isNotEmpty) {
          home.fetchDeviceLogs(home.devices.first.deviceId);
        }
      }
    });
  }

  bool _isDoorLock(String action) {
    final clean = action.toLowerCase().replaceAll(' ', '_');
    if (clean.contains('unlock')) return false;
    return clean.contains('door_closed') || clean.contains('closed') || clean.contains('lock');
  }

  bool _isDoorUnlock(String action) {
    final clean = action.toLowerCase().replaceAll(' ', '_');
    return clean.contains('unlock') || clean.contains('door_open') || clean.contains('opened');
  }

  @override
  Widget build(BuildContext context) {
    final home = context.watch<HomeViewModel>();
    final primaryTextColor = ParcelGlassColors.textPrimary(context);
    final secondaryTextColor = ParcelGlassColors.textSecondary(context);

    final filteredLogs = <LogModel>[];
    for (int i = 0; i < home.logs.length; i++) {
      final l = home.logs[i];
      final a = l.action.toLowerCase().replaceAll(' ', '_');

      if (a == 'door_open' || a == 'door_opened') {
        final hasAdjacentAppUnlock = home.logs.any((other) {
          final otherAction = other.action.toLowerCase();
          return otherAction.contains('unlock') &&
              !otherAction.contains('emergency') &&
              other.timestamp.difference(l.timestamp).abs().inSeconds <= 15;
        });

        if (hasAdjacentAppUnlock) continue;
        filteredLogs.add(l.copyWith(action: 'emergency_unlock'));
        continue;
      }

      // Deduplicate rapid consecutive duplicate offline or online events within 30s
      if (filteredLogs.isNotEmpty &&
          filteredLogs.last.action.toLowerCase() == l.action.toLowerCase() &&
          (a == 'device_offline' || a == 'device_online') &&
          filteredLogs.last.timestamp.difference(l.timestamp).abs().inSeconds <= 30) {
        continue;
      }

      // Deduplicate consecutive lock events: a locker cannot be locked twice without an unlock
      final isCurrentLock = _isDoorLock(a);
      if (isCurrentLock) {
        final lastDoorEvent = filteredLogs.cast<LogModel?>().lastWhere(
          (item) {
            if (item == null) return false;
            final itemAction = item.action.toLowerCase().replaceAll(' ', '_');
            return _isDoorUnlock(itemAction) || _isDoorLock(itemAction);
          },
          orElse: () => null,
        );

        if (lastDoorEvent != null) {
          final isLastDoorLock = _isDoorLock(lastDoorEvent.action);
          if (isLastDoorLock) {
            // Already locked; consecutive lock without an intervening unlock is redundant
            continue;
          }
        }
      }
      filteredLogs.add(l);
    }

    return ParcelGlassScaffold(
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: Center(
          child: ParcelCircleBackButton(
            onPressed: () => Navigator.pop(context),
          ),
        ),
        title: Text(
          'Locker Activity History',
          style: TextStyle(
            color: primaryTextColor,
            fontWeight: FontWeight.w900,
            fontSize: 18,
          ),
        ),
        centerTitle: true,
      ),
      child: home.loading
          ? const Center(
              child: CircularProgressIndicator(color: ParcelGlassColors.mintSignal),
            )
          : filteredLogs.isEmpty
              ? Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 380),
                    child: LiquidParcelCard(
                      borderRadius: 22,
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.history_toggle_off, color: secondaryTextColor, size: 22),
                          const SizedBox(width: 12),
                          Text(
                            'No activity recorded yet',
                            style: TextStyle(
                              color: secondaryTextColor,
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                )
              : Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 700),
                    child: ListView.builder(
                      physics: const BouncingScrollPhysics(),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      itemCount: filteredLogs.length,
                      itemBuilder: (context, index) {
                        return ParcelHistoryTile(log: filteredLogs[index]);
                      },
                    ),
                  ),
                ),
    );
  }
}
