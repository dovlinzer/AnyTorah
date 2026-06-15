package com.anytorah.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.anytorah.models.Bookmark
import com.anytorah.ui.theme.LocalAnyTorahColors

@Composable
fun BookmarkEditSheet(
    initialBookmark: Bookmark,
    onSave: (Bookmark) -> Unit,
    onDismiss: () -> Unit
) {
    val colors = LocalAnyTorahColors.current
    var name by remember { mutableStateOf(initialBookmark.name) }
    var notes by remember { mutableStateOf(initialBookmark.notes) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(colors.cardBackground)
            .padding(horizontal = 16.dp, vertical = 8.dp)
    ) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Save Bookmark",
                color = colors.appForeground,
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.weight(1f)
            )
            IconButton(onClick = onDismiss) {
                Icon(Icons.Default.Close, contentDescription = "Cancel", tint = colors.appForeground)
            }
        }

        Text(
            text = initialBookmark.subtitle,
            color = colors.secondaryText,
            fontSize = 13.sp,
            modifier = Modifier.padding(bottom = 16.dp)
        )

        // Name field
        OutlinedTextField(
            value = name,
            onValueChange = { name = it },
            label = { Text("Name", color = colors.secondaryText) },
            colors = OutlinedTextFieldDefaults.colors(
                focusedTextColor = colors.appForeground,
                unfocusedTextColor = colors.appForeground,
                focusedBorderColor = colors.editorialColor,
                unfocusedBorderColor = colors.dividerColor,
                cursorColor = colors.editorialColor
            ),
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )

        Spacer(modifier = Modifier.height(12.dp))

        // Notes field
        OutlinedTextField(
            value = notes,
            onValueChange = { notes = it },
            label = { Text("Notes (optional)", color = colors.secondaryText) },
            colors = OutlinedTextFieldDefaults.colors(
                focusedTextColor = colors.appForeground,
                unfocusedTextColor = colors.appForeground,
                focusedBorderColor = colors.editorialColor,
                unfocusedBorderColor = colors.dividerColor,
                cursorColor = colors.editorialColor
            ),
            modifier = Modifier.fillMaxWidth(),
            minLines = 2,
            maxLines = 4
        )

        Spacer(modifier = Modifier.height(16.dp))

        Button(
            onClick = {
                onSave(initialBookmark.copy(name = name.trim(), notes = notes.trim()))
            },
            enabled = name.isNotBlank(),
            modifier = Modifier.fillMaxWidth().height(48.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = colors.editorialColor,
                contentColor = Color(0xFF1B3A8A)
            )
        ) {
            Text("Save", fontWeight = FontWeight.SemiBold)
        }

        Spacer(modifier = Modifier.height(24.dp))
    }
}
