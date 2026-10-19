import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../models/log.model.dart';
import '../../../view_models/home_view_model.dart';
import '../../widgets/glass_theme.dart';
import '../../widgets/parcel_history_tile.dart';

class HomeHistoryTab extends StatelessWidget {
  const HomeHistoryTab({super.key});

  @override
  Widget build(BuildContext context) {
    final home = context.watch<HomeViewModel>();
    final validLogs = home.logs.where((l) {
      final a = l.action.toLowerCase().replaceAll(' ', '_');
      return a != 'door_open' && a != 'door_opened';
    }).toList();

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.only(left: 20, right: 20, top: 12, bottom: 110),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 700),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header with Rewind Clock Icon
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(7),
                      decoration: BoxDecoration(
                        color: ParcelGlassColors.navyTitle.withValues(alpha: 0.08),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.history_rounded,
                        color: ParcelGlassColors.navyTitle,
                        size: 22,
                      ),
                    ),
                    const SizedBox(width: 10),
                    const Text(
                      'Activity History',
                      style: TextStyle(
                        color: ParcelGlassColors.navyTitle,
                        fontSize: 25,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.5,
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 10),

              if (home.loading)
                const Center(
                  child: Padding(
                    padding: EdgeInsets.symmetric(vertical: 40),
                    child: CircularProgressIndicator(color: ParcelGlassColors.accentBlue),
                  ),
                )
              else if (validLogs.isEmpty)
                LiquidParcelCard(
                  useStaticGlass: true,
                  borderRadius: 22,
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.history_toggle_off,
                        color: ParcelGlassColors.slateSubtitle,
                        size: 22,
                      ),
                      SizedBox(width: 12),
                      Text(
                        'No activity recorded yet',
                        style: TextStyle(
                          color: ParcelGlassColors.slateSubtitle,
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                )
              else ...[
                ..._buildGroupedLogs(validLogs),
              ],
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _buildGroupedLogs(List<LogModel> logs) {
    final Map<String, List<LogModel>> grouped = {};
    for (final log in logs) {
      final label = _formatDateGroup(log.timestamp);
      grouped.putIfAbsent(label, () => []).add(log);
    }

    final List<Widget> widgets = [];
    grouped.forEach((dateLabel, groupLogs) {
      widgets.add(
        Padding(
          padding: const EdgeInsets.only(left: 6, top: 14, bottom: 8),
          child: Text(
            dateLabel.toUpperCase(),
            style: const TextStyle(
              color: ParcelGlassColors.slateSubtitle,
              fontSize: 11.5,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.8,
            ),
          ),
        ),
      );
      for (final log in groupLogs) {
        widgets.add(ParcelHistoryTile(log: log));
      }
    });

    return widgets;
  }

  String _formatDateGroup(DateTime dt) {
    final localDt = dt.toLocal();
    final now = DateTime.now();
    final isToday = localDt.year == now.year && localDt.month == now.month && localDt.day == now.day;
    if (isToday) return 'Today';
    final yesterday = now.subtract(const Duration(days: 1));
    final isYesterday = localDt.year == yesterday.year && localDt.month == yesterday.month && localDt.day == yesterday.day;
    if (isYesterday) return 'Yesterday';

    final months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${localDt.day} ${months[localDt.month - 1]} ${localDt.year}';
  }
}
