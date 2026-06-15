package com.anytorah.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.rememberSwipeToDismissBoxState
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
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BookmarkListScreen(
    bookmarks: List<Bookmark>,
    onSelect: (Bookmark) -> Unit,
    onDelete: (Bookmark) -> Unit,
    onDismiss: () -> Unit
) {
    val colors = LocalAnyTorahColors.current
    var searchQuery by remember { mutableStateOf("") }

    val filtered = if (searchQuery.isBlank()) bookmarks
    else bookmarks.filter { it.matches(searchQuery) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(colors.cardBackground)
    ) {
        // Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Bookmarks",
                color = colors.appForeground,
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.weight(1f)
            )
            IconButton(onClick = onDismiss) {
                Icon(Icons.Default.Close, contentDescription = "Close", tint = colors.appForeground)
            }
        }

        // Search
        TextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            placeholder = { Text("Search bookmarks", color = colors.secondaryText) },
            leadingIcon = {
                Icon(Icons.Default.Search, contentDescription = null, tint = colors.secondaryText)
            },
            trailingIcon = {
                if (searchQuery.isNotEmpty()) {
                    IconButton(onClick = { searchQuery = "" }) {
                        Icon(Icons.Default.Close, contentDescription = "Clear", tint = colors.secondaryText)
                    }
                }
            },
            colors = TextFieldDefaults.colors(
                focusedContainerColor = colors.dividerColor,
                unfocusedContainerColor = colors.dividerColor,
                focusedTextColor = colors.appForeground,
                unfocusedTextColor = colors.appForeground,
                cursorColor = colors.editorialColor,
                focusedIndicatorColor = Color.Transparent,
                unfocusedIndicatorColor = Color.Transparent
            ),
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            singleLine = true
        )

        HorizontalDivider(color = colors.dividerColor)

        if (filtered.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(120.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = if (bookmarks.isEmpty()) "No bookmarks yet" else "No results",
                    color = colors.secondaryText,
                    fontSize = 14.sp
                )
            }
        } else {
            LazyColumn {
                items(filtered, key = { it.id }) { bookmark ->
                    val dismissState = rememberSwipeToDismissBoxState(
                        confirmValueChange = { value ->
                            if (value == SwipeToDismissBoxValue.EndToStart) {
                                onDelete(bookmark)
                                true
                            } else false
                        }
                    )

                    SwipeToDismissBox(
                        state = dismissState,
                        backgroundContent = {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(Color(0xFFCC3333))
                                    .padding(horizontal = 24.dp),
                                contentAlignment = Alignment.CenterEnd
                            ) {
                                Icon(
                                    Icons.Default.Delete,
                                    contentDescription = "Delete",
                                    tint = Color.White
                                )
                            }
                        }
                    ) {
                        BookmarkRow(bookmark = bookmark, onClick = { onSelect(bookmark) })
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(32.dp))
    }
}

@Composable
private fun BookmarkRow(bookmark: Bookmark, onClick: () -> Unit) {
    val colors = LocalAnyTorahColors.current
    val dateFormat = SimpleDateFormat("MMM d, yyyy", Locale.getDefault())
    val dateStr = dateFormat.format(Date(bookmark.createdAt))

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(colors.cardBackground)
            .clickable { onClick() }
            .padding(horizontal = 16.dp, vertical = 12.dp)
    ) {
        Text(
            text = bookmark.name,
            color = colors.appForeground,
            fontSize = 15.sp,
            fontWeight = FontWeight.Medium
        )
        Text(
            text = bookmark.subtitle,
            color = colors.secondaryText,
            fontSize = 13.sp
        )
        if (bookmark.notes.isNotEmpty()) {
            Text(
                text = bookmark.notes,
                color = colors.secondaryText,
                fontSize = 12.sp,
                modifier = Modifier.padding(top = 2.dp)
            )
        }
        Text(
            text = dateStr,
            color = colors.secondaryText.copy(alpha = 0.6f),
            fontSize = 11.sp,
            modifier = Modifier.padding(top = 2.dp)
        )
    }
    HorizontalDivider(color = colors.dividerColor)
}
