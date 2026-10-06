import 'package:flutter/material.dart';
import 'package:immich_mobile/extensions/build_context_extensions.dart';
import 'package:immich_mobile/generated/translations.g.dart';

class NewAlbumNameModal extends StatefulWidget {
  /// Overrides the dialog title, e.g. when creating a sub-album.
  final String? title;

  /// Overrides the label of the confirm button.
  final String? confirmLabel;

  const NewAlbumNameModal({super.key, this.title, this.confirmLabel});

  @override
  State<NewAlbumNameModal> createState() => _NewAlbumNameModalState();
}

class _NewAlbumNameModalState extends State<NewAlbumNameModal> {
  TextEditingController nameController = TextEditingController();

  @override
  void dispose() {
    nameController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.title ?? context.t.album_name, style: const TextStyle(fontWeight: FontWeight.bold)),
      content: SingleChildScrollView(
        child: TextFormField(
          controller: nameController,
          textCapitalization: TextCapitalization.words,
          autofocus: true,
          decoration: InputDecoration(hintText: context.t.name, border: const OutlineInputBorder()),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => context.pop(null),
          child: Text(
            context.t.cancel,
            style: TextStyle(color: Colors.red[300], fontWeight: FontWeight.bold),
          ),
        ),
        TextButton(
          onPressed: () {
            context.pop(nameController.text.trim());
          },
          child: Text(
            widget.confirmLabel ?? context.t.create_album,
            style: TextStyle(color: context.primaryColor, fontWeight: FontWeight.bold),          ),
        ),
      ],
    );
  }
}
