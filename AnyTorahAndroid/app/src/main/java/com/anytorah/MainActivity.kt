package com.anytorah

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.anytorah.audio.AudioPlayer
import com.anytorah.ui.DedicationDialog
import com.anytorah.ui.screens.HomeScreen
import com.anytorah.ui.screens.SplashScreen
import com.anytorah.ui.screens.TextReaderScreen
import com.anytorah.ui.theme.AnyTorahTheme
import com.anytorah.viewmodels.TextReaderViewModel

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            val vm: TextReaderViewModel = viewModel()
            val audioPlayer = remember { AudioPlayer(this) }
            val navController = rememberNavController()
            val dedication by vm.dedication.collectAsState()

            AnyTorahTheme(useWhiteBackground = vm.useWhiteBackground) {
                dedication?.let {
                    DedicationDialog(dedication = it, onDismiss = { vm.dismissDedication() })
                }

                NavHost(
                    navController = navController,
                    startDestination = "splash"
                ) {
                    composable("splash") {
                        SplashScreen(
                            onFinished = {
                                vm.checkDedication()
                                navController.navigate("home") {
                                    popUpTo("splash") { inclusive = true }
                                }
                            }
                        )
                    }

                    composable("home") {
                        HomeScreen(
                            vm = vm,
                            onRead = {
                                navController.navigate("reader")
                            }
                        )
                    }

                    composable("reader") {
                        TextReaderScreen(
                            vm = vm,
                            audioPlayer = audioPlayer,
                            onBack = {
                                navController.popBackStack()
                            },
                            onNavigateToSelector = {
                                navController.navigate("home")
                            }
                        )
                    }
                }
            }
        }
    }
}
