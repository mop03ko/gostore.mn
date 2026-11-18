# Unpack an undispatched Erenhot batch

Open a GB batch and choose **拆包 / 移出订单**. Select individual GS orders or **全选订单**, enter the reason and confirm that the package has not left the warehouse and the selected goods have physically been removed. The manifest also has **移出包裹** beside each order.

The assigned Erenhot manager can unpack draft or ready batches. Removed GS records return to `erenhot` without batch membership. Their owner, purchase payment, photos, measurements and confirmed freight remain unchanged. They can be split or packed into a new batch. If members remain, the original batch returns to draft and requires fresh scans; print its updated label/manifest. If all members are removed, the old GB record is cancelled and its label must be discarded. History and the reason are retained; records are not deleted.

`warehouse-batch-unpack` validates role, source warehouse, batch version, nonempty unique selection, membership, confirmation, reason and every member's state in one transaction. Settled or dispatched cargo cannot be unpacked. Changes increment logistics versions and record audit events, so stale order operations cannot reuse an earlier version. Customer tracking follows the restored Erenhot state and does not expose another customer's batch contents.

Validation: `node tests/run-logistics.cjs warehouse-unpack warehouse-batches warehouse-flow`. Tests exercise partial/full unpack from ready/draft, payment/photo/freight preservation, splitting and repacking, invalid and foreign selection, stale retries, dispatched locks, Chinese mobile selection/confirmation and widths 360–1280. Only isolated fixture orders are used.

Released 2026-11-18 to the warehouse web application (also used by the Erenhot APK). Five production files were backed up, deployed and hash-verified; public scripts were checked and anonymous warehouse access remained denied. Backup: `/gostore-backups/batch-unpack-20261118-4108e96a`. Refresh the app to load the change; no new APK is required.
